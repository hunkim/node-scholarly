import * as cheerio from 'cheerio';
import { Navigator } from './navigator';
import { Author, AuthorSource, PublicAccess, Publication } from './dataTypes';
import { PublicationParser } from './publicationParser';

const CITATIONAUTHRE = /user=([\w-]*)/;
const EMAILAUTHORRE = /Verified email at /;
const CITATIONAUTH = '/citations?hl=en&user={0}';
const COAUTH = '/citations?view_op=list_colleagues&hl=en&user={0}';
const MANDATES = '/citations?hl=en&tzom=300&user={0}&view_op=list_mandates&pagesize={1}';
const PAGESIZE = 100;

export class AuthorParser {
  private nav: Navigator;
  private sections = ['basics', 'indices', 'counts', 'coauthors', 'publications', 'public_access'];

  constructor(nav: Navigator) {
    this.nav = nav;
  }

  getAuthor(data: any): Author {
    const author: Author = {
      container_type: 'Author',
      scholar_id: '',
      filled: [],
      source: AuthorSource.AUTHOR_PROFILE_PAGE,
    };

    if (typeof data === 'string') {
      author.scholar_id = data;
      author.source = AuthorSource.AUTHOR_PROFILE_PAGE;
    } else {
      author.source = AuthorSource.SEARCH_AUTHOR_SNIPPETS;
      const link = data.find('a').first().attr('href');
      if (link) {
        const match = link.match(CITATIONAUTHRE);
        if (match) {
          author.scholar_id = match[1];
        }
      }

      const pic = `/citations?view_op=medium_photo&user=${author.scholar_id}`;
      author.url_picture = `https://scholar.google.com${pic}`;

      const nameClass = this.findTagClassName(data, 'h3', 'name');
      if (nameClass) {
        author.name = data.find(`h3.${nameClass}`).text();
      }

      const affClass = this.findTagClassName(data, 'div', 'aff');
      if (affClass) {
        const affiliation = data.find(`div.${affClass}`).text();
        if (affiliation) {
          author.affiliation = affiliation;
        }
      }

      const emlClass = this.findTagClassName(data, 'div', 'eml');
      if (emlClass) {
        const email = data.find(`div.${emlClass}`).text();
        if (email) {
          author.email_domain = email.replace(EMAILAUTHORRE, '@');
        }
      }

      const intClass = this.findTagClassName(data, 'a', 'one_int');
      if (intClass) {
        const interests = data.find(`a.${intClass}`).toArray();
        author.interests = interests.map((i: any) => data(i).text().trim());
      } else {
        author.interests = [];
      }

      const cbyClass = this.findTagClassName(data, 'div', 'cby');
      if (cbyClass) {
        const citedby = data.find(`div.${cbyClass}`).text();
        if (citedby && citedby !== '') {
          const match = citedby.match(/\d+/);
          if (match) {
            author.citedby = parseInt(match[0]);
          }
        }
      }
    }

    return author;
  }

  private getSectionMethodName(section: string): string {
    // Convert section name to method name: 'public_access' -> 'fillPublicAccess'
    const parts = section.split('_');
    const capitalizedParts = parts.map(part => part.charAt(0).toUpperCase() + part.slice(1));
    return 'fill' + capitalizedParts.join('');
  }

  private findTagClassName($data: any, tag: string, text: string): string | null {
    const elements = $data.find(tag).toArray();
    for (const element of elements) {
      const $elem = $data(element);
      const classAttr = $elem.attr('class');
      if (classAttr && classAttr.includes(text)) {
        return classAttr.split(' ')[0];
      }
    }
    return null;
  }

  async fill(
    author: Author,
    sections: string[] = [],
    sortby: string = 'citedby',
    publicationLimit: number = 0
  ): Promise<Author> {
    try {
      sections = sections.map(s => s.toLowerCase()).sort().reverse();

      let sortbyStr = '';
      // Support multiple aliases: 'year', 'date', 'pubdate' all map to sorting by publication date
      if (sortby === 'year' || sortby === 'date' || sortby === 'pubdate') {
        sortbyStr = '&view_op=list_works&sortby=pubdate';
      } else if (sortby !== 'citedby') {
        throw new Error("Please enter a valid sortby parameter. Options: 'citedby', 'year', 'date', 'pubdate'");
      }

      const urlCitations = CITATIONAUTH.replace('{0}', author.scholar_id) + sortbyStr;
      const url = `${urlCitations}&pagesize=${PAGESIZE}`;
      const $ = await this.nav.getSoup(url);

      // Update scholar_id if redirected
      const canonical = $('link[rel="canonical"]').attr('href');
      if (canonical) {
        const match = canonical.match(CITATIONAUTHRE);
        if (match && match[1] !== author.scholar_id) {
          console.warn(
            `Changing scholar_id from ${author.scholar_id} to ${match[1]} following redirect.`
          );
          author.scholar_id = match[1];
        }
      }

      if (sections.length === 0) {
        for (const section of this.sections) {
          if (!author.filled.includes(section)) {
            if (section === 'publications') {
              await this.fillPublications($, author, publicationLimit, sortbyStr);
            } else {
              const methodName = this.getSectionMethodName(section);
              await (this as any)[methodName]($, author);
            }
            author.filled.push(section);
          }
        }
      } else {
        for (const section of sections) {
          if (this.sections.includes(section) && !author.filled.includes(section)) {
            if (section === 'publications') {
              await this.fillPublications($, author, publicationLimit, sortbyStr);
            } else {
              const methodName = this.getSectionMethodName(section);
              await (this as any)[methodName]($, author);
            }
            author.filled.push(section);
          }
        }
      }
    } catch (error: any) {
      throw error;
    }

    return author;
  }

  private async fillBasics($: cheerio.CheerioAPI, author: Author): Promise<void> {
    author.name = $('#gsc_prf_in').text();

    if (author.source === AuthorSource.AUTHOR_PROFILE_PAGE) {
      const img = $('#gsc_prf_pup-img');
      if (img.length) {
        const src = img.attr('src');
        if (src && !src.includes('avatar_scholar')) {
          author.url_picture = src;
        }
      }
    }

    const affiliation = $('.gsc_prf_il').first();
    author.affiliation = affiliation.text();

    const affiliationLink = affiliation.find('a');
    if (affiliationLink.length) {
      const href = affiliationLink.attr('href');
      if (href) {
        const orgMatch = href.match(/org=(\d+)/);
        if (orgMatch) {
          author.organization = parseInt(orgMatch[1]);
        }
      }
    }

    author.interests = $('.gsc_prf_inta')
      .toArray()
      .map(i => $(i).text().trim());

    const email = $('#gsc_prf_ivh.gsc_prf_il');
    if (email.length && author.source === AuthorSource.AUTHOR_PROFILE_PAGE) {
      const emailText = email.text();
      if (emailText !== 'No verified email') {
        const parts = emailText.split(' ');
        if (parts.length >= 4) {
          author.email_domain = '@' + parts[3];
        }
      }
    }

    const homepage = email.find('a.gsc_prf_ila');
    if (homepage.length) {
      author.homepage = homepage.attr('href');
    }

    const index = $('.gsc_rsb_std').toArray();
    if (index.length > 0) {
      author.citedby = parseInt($(index[0]).text()) || 0;
    }
  }

  private async fillIndices($: cheerio.CheerioAPI, author: Author): Promise<void> {
    const index = $('.gsc_rsb_std').toArray();
    if (index.length >= 6) {
      author.citedby = parseInt($(index[0]).text()) || 0;
      author.citedby5y = parseInt($(index[1]).text()) || 0;
      author.hindex = parseInt($(index[2]).text()) || 0;
      author.hindex5y = parseInt($(index[3]).text()) || 0;
      author.i10index = parseInt($(index[4]).text()) || 0;
      author.i10index5y = parseInt($(index[5]).text()) || 0;
    } else {
      author.hindex = 0;
      author.hindex5y = 0;
      author.i10index = 0;
      author.i10index5y = 0;
    }
  }

  private async fillCounts($: cheerio.CheerioAPI, author: Author): Promise<void> {
    const years = $('.gsc_g_t')
      .toArray()
      .map(y => parseInt($(y).text()));

    const cites: number[] = new Array(years.length).fill(0);
    $('.gsc_g_a').each((idx, c) => {
      const $c = $(c);
      const style = $c.attr('style');
      if (style) {
        const match = style.match(/z-index:(\d+)/);
        if (match) {
          const i = parseInt(match[1]);
          const count = parseInt($c.find('.gsc_g_al').text()) || 0;
          cites[cites.length - i] = count;
        }
      }
    });

    author.cites_per_year = {};
    years.forEach((year, idx) => {
      author.cites_per_year![year] = cites[idx];
    });
  }

  private async fillPublicAccess($: cheerio.CheerioAPI, author: Author): Promise<void> {
    const available = $('.gsc_rsb_m_a');
    const notAvailable = $('.gsc_rsb_m_na');

    let nAvailable = 0;
    let nNotAvailable = 0;

    if (available.length) {
      const text = available.text().split(' ')[0];
      nAvailable = parseInt(text.replace(/[.,]/g, '')) || 0;
    }

    if (notAvailable.length) {
      const text = notAvailable.text().split(' ')[0];
      nNotAvailable = parseInt(text.replace(/[.,]/g, '')) || 0;
    }

    author.public_access = {
      available: nAvailable,
      not_available: nNotAvailable,
    };

    // Mark individual publications with public_access status
    if (!author.filled.includes('publications')) {
      return;
    }

    // Create publication lookup map
    const publicationsMap: { [key: string]: Publication } = {};
    author.publications?.forEach(pub => {
      if (pub.author_pub_id) {
        publicationsMap[pub.author_pub_id] = pub;
      }
    });

    // Fetch mandate pages and mark publications
    const mandatesUrl = MANDATES.replace('{0}', author.scholar_id).replace('{1}', String(PAGESIZE));
    let $mandates = await this.nav.getSoup(mandatesUrl);

    while (true) {
      // Mark not available publications
      const notAvailSection = $mandates('.gsc_mnd_sec_na').first();
      if (notAvailSection.length) {
        notAvailSection.find('a.gsc_mnd_art_rvw').each((i: number, row: any) => {
          const href = $mandates(row).attr('data-href');
          if (href) {
            const match = href.match(/citation_for_view=([\w:-]*)/);
            if (match && publicationsMap[match[1]]) {
              publicationsMap[match[1]].public_access = false;
            }
          }
        });
      }

      // Mark available publications
      const availSection = $mandates('.gsc_mnd_sec_avl').first();
      if (availSection.length) {
        availSection.find('a.gsc_mnd_art_rvw').each((i: number, row: any) => {
          const href = $mandates(row).attr('data-href');
          if (href) {
            const match = href.match(/citation_for_view=([\w:-]*)/);
            if (match && publicationsMap[match[1]]) {
              publicationsMap[match[1]].public_access = true;
            }
          }
        });
      }

      // Check for next page
      const nextButton = $mandates('.gs_btnPR');
      if (nextButton.length && !nextButton.attr('disabled')) {
        const onclick = nextButton.attr('onclick');
        if (onclick) {
          // Extract URL from onclick="window.location='...'"
          const urlMatch = onclick.match(/window\.location='([^']*)'/);
          if (urlMatch) {
            let url = urlMatch[1];
            // Decode HTML entities and unicode escapes
            url = url.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
              String.fromCharCode(parseInt(hex, 16))
            );
            $mandates = await this.nav.getSoup(url);
          } else {
            break;
          }
        } else {
          break;
        }
      } else {
        break;
      }
    }
  }

  private async fillPublications(
    $: cheerio.CheerioAPI,
    author: Author,
    publicationLimit: number,
    sortbyStr: string
  ): Promise<void> {
    author.publications = [];
    let pubstart = 0;
    const urlCitations = CITATIONAUTH.replace('{0}', author.scholar_id) + sortbyStr;

    const pubParser = new PublicationParser(this.nav);
    let flag = false;

    while (true) {
      const rows = $('.gsc_a_tr').toArray();
      for (const row of rows) {
        const newPub = pubParser.getPublication($(row), 'AUTHOR_PUBLICATION_ENTRY');
        author.publications.push(newPub);

        if (publicationLimit && author.publications.length >= publicationLimit) {
          flag = true;
          break;
        }
      }

      const moreButton = $('#gsc_bpf_more');
      if (!moreButton.attr('disabled') && !flag) {
        pubstart += PAGESIZE;
        const url = `${urlCitations}&cstart=${pubstart}&pagesize=${PAGESIZE}`;
        $ = await this.nav.getSoup(url);
      } else {
        break;
      }
    }
  }

  private getCoauthorsShort($: cheerio.CheerioAPI): { ids: string[], names: string[], affiliations: string[] } {
    const coauthors = $('.gsc_rsb_a_desc').toArray();
    const ids: string[] = [];
    const names: string[] = [];
    const affiliations: string[] = [];

    for (const coauth of coauthors) {
      const $coauth = $(coauth);
      const link = $coauth.find('a').first();
      const href = link.attr('href');

      if (href) {
        const match = href.match(CITATIONAUTHRE);
        if (match) {
          ids.push(match[1]);
          const nameElem = $coauth.find('[tabindex="-1"]');
          names.push(nameElem.length ? nameElem.text().trim() : link.text().trim());
          affiliations.push($coauth.find('.gsc_rsb_a_ext').text().trim());
        }
      }
    }

    return { ids, names, affiliations };
  }

  private async getCoauthorsLong(author: Author): Promise<{ ids: string[], names: string[], affiliations: string[] }> {
    const url = COAUTH.replace('{0}', author.scholar_id);
    const $ = await this.nav.getSoup(url);

    const coauthors = $('.gs_ai.gs_scl').toArray();
    const ids: string[] = [];
    const names: string[] = [];
    const affiliations: string[] = [];

    for (const coauth of coauthors) {
      const $coauth = $(coauth);
      const link = $coauth.find('a').first();
      const href = link.attr('href');

      if (href) {
        const match = href.match(CITATIONAUTHRE);
        if (match) {
          ids.push(match[1]);
          names.push($coauth.find('.gs_ai_name').text().trim());
          affiliations.push($coauth.find('.gs_ai_aff').text().trim());
        }
      }
    }

    return { ids, names, affiliations };
  }

  private async fillCoauthors($: cheerio.CheerioAPI, author: Author): Promise<void> {
    author.coauthors = [];

    // Check if "View All" button exists
    const viewAllButton = $('#gsc_coauth_opn');

    let coauthorInfo: { ids: string[], names: string[], affiliations: string[] };

    if (viewAllButton.length === 0) {
      // Short list (≤20 coauthors)
      coauthorInfo = this.getCoauthorsShort($);
    } else {
      // Long list (>20 coauthors) - try to fetch all
      try {
        coauthorInfo = await this.getCoauthorsLong(author);
      } catch (error) {
        console.warn('Failed to fetch long coauthor list, falling back to short list:', error);
        coauthorInfo = this.getCoauthorsShort($);
      }
    }

    // Build coauthor list
    for (let i = 0; i < coauthorInfo.ids.length; i++) {
      const newCoauthor = this.getAuthor(coauthorInfo.ids[i]);
      newCoauthor.name = coauthorInfo.names[i];
      newCoauthor.affiliation = coauthorInfo.affiliations[i];
      newCoauthor.source = AuthorSource.CO_AUTHORS_LIST;
      author.coauthors.push(newCoauthor);
    }
  }
}

