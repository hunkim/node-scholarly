import * as cheerio from 'cheerio';
import { Navigator } from './navigator';
import { Publication, PublicationSource, BibEntry } from './dataTypes';

const SCHOLARPUBRE = /cites=([\d,]*)/;
const CITATIONPUB = '/citations?hl=en&view_op=view_citation&citation_for_view={0}';
const CITATIONPUBRE = /citation_for_view=([\w-]*:[\w-]*)/;
const BIBCITE = '/scholar?hl=en&q=info:{0}:scholar.google.com/&output=cite&scirp={1}&hl=en';
const CITEDBYLINK = '/scholar?hl=en&cites={0}';

export class SearchScholarIterator {
  private url: string;
  private pubtype: PublicationSource;
  private nav: Navigator;
  private $: cheerio.CheerioAPI | null = null;
  private pos: number = 0;
  private rows: any[] = [];
  public totalResults: number = 0;
  private pubParser: PublicationParser;

  constructor(nav: Navigator, url: string) {
    this.url = url;
    this.pubtype = url.includes('/scholar?')
      ? PublicationSource.PUBLICATION_SEARCH_SNIPPET
      : PublicationSource.JOURNAL_CITATION_LIST;
    this.nav = nav;
    this.pubParser = new PublicationParser(this.nav);
  }

  async initialize(): Promise<void> {
    await this.loadUrl(this.url);
    this.totalResults = this.getTotalResults();
  }

  private async loadUrl(url: string): Promise<void> {
    this.$ = await this.nav.getSoup(url);
    this.pos = 0;
    const gsRows = this.$('.gs_r.gs_or.gs_scl').toArray();
    const gscRows = this.$('.gsc_mpat_ttl').toArray();
    this.rows = [...gsRows, ...gscRows];
  }

  private getTotalResults(): number {
    if (!this.$) return 0;

    if (this.$('.gs_pda').length) {
      return 0;
    }

    const mdwElements = this.$('.gs_ab_mdw').toArray();
    for (const elem of mdwElements) {
      const text = this.$!(elem).text();
      const match = text.match(/(^|\s*About)\s*([0-9,\.\s']+)/);
      if (match) {
        return parseInt(match[2].replace(/[,\.\s']/g, ''));
      }
    }

    return 0;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Publication> {
    await this.initialize();

    while (true) {
      if (this.pos < this.rows.length) {
        const row = this.rows[this.pos];
        this.pos++;
        const res = this.pubParser.getPublication(this.$!(row), this.pubtype);
        yield res;
      } else {
        const nextButton = this.$!('.gs_ico.gs_ico_nav_next');
        if (nextButton.length) {
          const parent = nextButton.parent();
          const href = parent.attr('href');
          if (href) {
            this.url = href;
            await this.loadUrl(href);
            continue;
          }
        }
        break;
      }
    }
  }

  async next(): Promise<Publication | null> {
    if (!this.$) {
      await this.initialize();
    }

    if (this.pos < this.rows.length) {
      const row = this.rows[this.pos];
      this.pos++;
      return this.pubParser.getPublication(this.$!(row), this.pubtype);
    } else {
      const nextButton = this.$!('.gs_ico.gs_ico_nav_next');
      if (nextButton.length) {
        const parent = nextButton.parent();
        const href = parent.attr('href');
        if (href) {
          this.url = href;
          await this.loadUrl(href);
          return this.next();
        }
      }
    }

    return null;
  }
}

export class PublicationParser {
  private nav: Navigator;

  constructor(nav: Navigator) {
    this.nav = nav;
  }

  getPublication($data: any, pubtype: PublicationSource | string): Publication {
    const publication: Publication = {
      container_type: 'Publication',
      source: typeof pubtype === 'string' ? PublicationSource[pubtype as keyof typeof PublicationSource] : pubtype,
      bib: {},
      filled: false,
    };

    if (publication.source === PublicationSource.AUTHOR_PUBLICATION_ENTRY) {
      return this.citationPub($data, publication);
    } else if (publication.source === PublicationSource.PUBLICATION_SEARCH_SNIPPET) {
      return this.scholarPub($data, publication);
    }

    return publication;
  }

  private citationPub($elem: any, publication: Publication): Publication {
    const titleLink = $elem.find('a.gsc_a_at');
    publication.bib.title = titleLink.text();

    const href = titleLink.attr('href');
    if (href) {
      const match = href.match(CITATIONPUBRE);
      if (match) {
        publication.author_pub_id = match[1];
      }
    }

    const citedby = $elem.find('.gsc_a_ac');
    publication.num_citations = 0;

    if (citedby.length) {
      const citedbyText = citedby.text().trim();
      if (citedbyText && !citedbyText.match(/^\s*$/)) {
        publication.num_citations = parseInt(citedbyText) || 0;
        const citedbyHref = citedby.attr('href');
        if (citedbyHref) {
          publication.citedby_url = citedbyHref;
          const match = citedbyHref.match(SCHOLARPUBRE);
          if (match) {
            publication.cites_id = match[1].split(',');
          }
        }
      }
    }

    const year = $elem.find('.gsc_a_h');
    if (year.length) {
      const yearText = year.text().trim();
      if (yearText && yearText.length > 0) {
        publication.bib.pub_year = yearText;
      }
    }

    const authorCitation = $elem.find('.gs_gray');
    let citation = '';
    if (authorCitation.length > 1) {
      citation = authorCitation.eq(1).text();
    }
    publication.bib.citation = citation;

    return publication;
  }

  private scholarPub($elem: any, publication: Publication): Publication {
    const databox = $elem.find('.gs_ri');
    const title = databox.find('h3.gs_rt');

    const cid = $elem.attr('data-cid');
    const pos = $elem.attr('data-rp');

    if (pos) {
      publication.gsrank = parseInt(pos) + 1;
    }

    // Remove citation badges
    title.find('.gs_ctu').remove();
    title.find('.gs_ctc').remove();

    publication.bib.title = title.text().trim();

    const titleLink = title.find('a');
    if (titleLink.length) {
      publication.pub_url = titleLink.attr('href');
    }

    const authorDiv = databox.find('.gs_a');
    let authorinfo = authorDiv.text();
    authorinfo = authorinfo.replace(/\u00a0/g, ' ').replace(/&amp;/g, '&');

    publication.bib.author = this.getAuthorList(authorinfo);

    const authorinfoHtml = authorDiv.html() || '';
    publication.author_id = this.getAuthorIdList(authorinfoHtml);

    // Parse venue/year
    const venueyear = authorinfo.split(' - ');
    if (venueyear.length <= 2) {
      publication.bib.venue = 'NA';
      publication.bib.pub_year = 'NA';
    } else {
      const venueyearParts = venueyear[1].split(',');
      let venue = 'NA';
      const year = venueyearParts[venueyearParts.length - 1].trim();

      if (/^\d{4}$/.test(year)) {
        publication.bib.pub_year = year;
        if (venueyearParts.length >= 2) {
          venue = venueyearParts.slice(0, -1).join(',');
        }
      } else {
        venue = venueyearParts.join(',');
        publication.bib.pub_year = 'NA';
      }
      publication.bib.venue = venue;
    }

    const abstract = databox.find('.gs_rs');
    if (abstract.length) {
      let abstractText = abstract.text();
      abstractText = abstractText.replace(/\u2026/g, '').replace(/\n/g, ' ').trim();
      if (abstractText.toLowerCase().startsWith('abstract')) {
        abstractText = abstractText.substring(8).trim();
      }
      publication.bib.abstract = abstractText;
    }

    if (cid && pos) {
      publication.url_scholarbib = BIBCITE.replace('{0}', cid).replace('{1}', pos);
      const sclib = this.nav.publib.replace('{id}', cid);
      publication.url_add_sclib = sclib;
    }

    const lowerlinks = databox.find('.gs_fl a');
    publication.num_citations = 0;

    lowerlinks.each((i: number, link: any) => {
      const $link = $elem.constructor(link);
      const linkText = $link.text();

      if (linkText.includes('Cited by')) {
        const match = linkText.match(/\d+/);
        if (match) {
          publication.num_citations = parseInt(match[0]);
          publication.citedby_url = $link.attr('href');
        }
      }

      if (linkText.includes('Related articles')) {
        publication.url_related_articles = $link.attr('href');
      }
    });

    const eprintDiv = $elem.find('.gs_ggs.gs_fl');
    if (eprintDiv.length) {
      const eprintLink = eprintDiv.find('a');
      if (eprintLink.length) {
        publication.eprint_url = eprintLink.attr('href');
      }
    }

    return publication;
  }

  private getAuthorList(authorinfo: string): string[] {
    const authorlist: string[] = [];
    const text = authorinfo.split(' - ')[0];

    for (let author of text.split(',')) {
      author = author.trim();
      if (/\d/.test(author)) continue;
      if (
        author.includes('Proceedings') ||
        author.includes('Conference') ||
        author.includes('Journal') ||
        author.includes('(') ||
        author.includes(')') ||
        author.includes('[') ||
        author.includes(']') ||
        author.includes('Transactions')
      ) {
        continue;
      }
      author = author.replace('…', '');
      authorlist.push(author);
    }

    return authorlist;
  }

  private getAuthorIdList(authorinfoHtml: string): string[] {
    const authorIdList: string[] = [];
    const html = authorinfoHtml.split(' - ')[0];

    for (const authorHtml of html.split(',')) {
      const match = authorHtml.match(/\?user=(.*?)&amp;/);
      if (match) {
        authorIdList.push(match[1]);
      } else {
        authorIdList.push('');
      }
    }

    return authorIdList;
  }

  async fill(publication: Publication): Promise<Publication> {
    if (publication.source === PublicationSource.AUTHOR_PUBLICATION_ENTRY) {
      const url = CITATIONPUB.replace('{0}', publication.author_pub_id!);
      const $ = await this.nav.getSoup(url);

      publication.bib.title = $('#gsc_oci_title').text();

      const titleLink = $('a.gsc_oci_title_link');
      if (titleLink.length) {
        publication.pub_url = titleLink.attr('href');
      }

      const items = $('.gs_scl').toArray();
      for (const item of items) {
        const $item = $(item);
        const key = $item.find('.gsc_oci_field').text().trim().toLowerCase();
        const val = $item.find('.gsc_oci_value');

        if (key === 'authors' || key === 'inventors') {
          const authors = val
            .text()
            .split(',')
            .map(a => a.trim());
          publication.bib.author = authors.join(' and ');
        } else if (key === 'journal') {
          publication.bib.journal = val.text();
        } else if (key === 'conference') {
          publication.bib.conference = val.text();
        } else if (key === 'volume') {
          publication.bib.volume = val.text();
        } else if (key === 'issue') {
          publication.bib.number = val.text();
        } else if (key === 'pages') {
          publication.bib.pages = val.text();
        } else if (key === 'publisher') {
          publication.bib.publisher = val.text();
        } else if (key === 'publication date') {
          const dateText = val.text();
          const yearMatch = dateText.match(/\d{4}/);
          if (yearMatch) {
            publication.bib.pub_year = yearMatch[0];
          }
        } else if (key === 'description') {
          let abstractText = val.text();
          if (abstractText.toLowerCase().startsWith('abstract')) {
            abstractText = abstractText.substring(8).trim();
          }
          publication.bib.abstract = abstractText;
        } else if (key === 'total citations') {
          const href = val.find('a').attr('href');
          if (href) {
            const match = href.match(SCHOLARPUBRE);
            if (match) {
              publication.cites_id = match[1].split(',');
              publication.citedby_url = CITEDBYLINK.replace('{0}', publication.cites_id.join(','));
            }
          }
        } else if (key === 'scholar articles') {
          const links = val.find('a').toArray();
          for (const link of links) {
            const $link = $(link);
            if ($link.text().toLowerCase() === 'related articles') {
              const href = $link.attr('href');
              if (href && href.length > 26) {
                publication.url_related_articles = href.substring(26);
              }
              break;
            }
          }
        }
      }

      // Citations per year
      const years = $('.gsc_oci_g_t')
        .toArray()
        .map(y => parseInt($(y).text()));
      const cites = $('.gsc_oci_g_al')
        .toArray()
        .map(c => parseInt($(c).text()));
      const citesYear = $('.gsc_oci_g_a')
        .toArray()
        .map(c => {
          const href = $(c).attr('href');
          if (href) {
            return parseInt(href.slice(-4));
          }
          return 0;
        });

      const nonzeroCitesPerYear: { [key: number]: number } = {};
      citesYear.forEach((year, idx) => {
        nonzeroCitesPerYear[year] = cites[idx];
      });

      publication.cites_per_year = {};
      for (const year of years) {
        publication.cites_per_year[year] = nonzeroCitesPerYear[year] || 0;
      }

      const eprintDiv = $('.gsc_vcd_title_ggi');
      if (eprintDiv.length) {
        const eprintLink = eprintDiv.find('a');
        if (eprintLink.length) {
          publication.eprint_url = eprintLink.attr('href');
        }
      }

      publication.filled = true;
    } else if (publication.source === PublicationSource.PUBLICATION_SEARCH_SNIPPET) {
      // For PUBLICATION_SEARCH_SNIPPET, we would need to fetch and parse BibTeX
      // This is simplified for now
      publication.filled = true;
    }

    return publication;
  }

  async citedby(publication: Publication): Promise<SearchScholarIterator> {
    if (!publication.filled) {
      publication = await this.fill(publication);
    }
    return new SearchScholarIterator(this.nav, publication.citedby_url!);
  }

  async bibtex(publication: Publication): Promise<string> {
    if (!publication.filled) {
      publication = await this.fill(publication);
    }

    // Generate a simple BibTeX entry
    const bib = publication.bib;
    const type = bib.pub_type || 'article';
    const id = bib.bib_id || 'scholar_article';

    let bibtex = `@${type}{${id},\n`;

    if (bib.title) bibtex += `  title={${bib.title}},\n`;
    if (bib.author) bibtex += `  author={${bib.author}},\n`;
    if (bib.journal) bibtex += `  journal={${bib.journal}},\n`;
    if (bib.conference) bibtex += `  booktitle={${bib.conference}},\n`;
    if (bib.volume) bibtex += `  volume={${bib.volume}},\n`;
    if (bib.number) bibtex += `  number={${bib.number}},\n`;
    if (bib.pages) bibtex += `  pages={${bib.pages}},\n`;
    if (bib.pub_year) bibtex += `  year={${bib.pub_year}},\n`;
    if (bib.publisher) bibtex += `  publisher={${bib.publisher}},\n`;

    bibtex += '}\n';

    return bibtex;
  }
}

