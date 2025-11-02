import { config } from 'dotenv';
import { Navigator } from './navigator';
import { ProxyGenerator } from './proxyGenerator';
import { AuthorParser } from './authorParser';
import { PublicationParser, SearchScholarIterator } from './publicationParser';
import { Author, Publication, PublicationSource, Journal } from './dataTypes';

config();

// Valid sort options for author publications
export type AuthorSortBy = 'citedby' | 'year' | 'date' | 'pubdate';

const AUTHSEARCH = '/citations?hl=en&view_op=search_authors&mauthors={0}';
const KEYWORDSEARCH = '/citations?hl=en&view_op=search_authors&mauthors=label:{0}';
const KEYWORDSEARCHBASE = '/citations?hl=en&view_op=search_authors&mauthors={}';
const KEYWORDSEARCH_PATTERN = /[-: #(),;]+/g;
const PUBSEARCH = '/scholar?hl=en&q={0}';
const CITEDBYSEARCH = '/scholar?hl=en&cites={0}';
const ORGSEARCH = '/citations?view_op=view_org&hl=en&org={0}';
const MANDATES_URL = 'https://scholar.google.com/citations?view_op=mandates_leaderboard_csv&hl=en';

export class Scholarly {
  private nav: Navigator;
  private journalCategories: { [key: string]: any } | null = null;

  constructor() {
    this.nav = Navigator.getInstance();
  }

  setRetries(numRetries: number): void {
    this.nav.setRetries(numRetries);
  }

  useProxy(proxyGenerator: ProxyGenerator, secondaryProxyGenerator?: ProxyGenerator): void {
    this.nav.useProxy(proxyGenerator, secondaryProxyGenerator);
  }

  setTimeout(timeout: number): void {
    this.nav.setTimeout(timeout);
  }

  async searchPubs(
    query: string,
    options: {
      patents?: boolean;
      citations?: boolean;
      yearLow?: number;
      yearHigh?: number;
      sortBy?: 'relevance' | 'date';
      includeLastYear?: 'abstracts' | 'everything';
      startIndex?: number;
    } = {}
  ): Promise<SearchScholarIterator> {
    const {
      patents = true,
      citations = true,
      yearLow,
      yearHigh,
      sortBy = 'relevance',
      includeLastYear = 'abstracts',
      startIndex = 0,
    } = options;

    const url = this.constructUrl(PUBSEARCH.replace('{0}', encodeURIComponent(query)), {
      patents,
      citations,
      yearLow,
      yearHigh,
      sortBy,
      includeLastYear,
      startIndex,
    });

    return this.nav.searchPublications(url);
  }

  async searchCitedby(
    publicationId: string | number,
    options: any = {}
  ): Promise<SearchScholarIterator> {
    const url = this.constructUrl(CITEDBYSEARCH.replace('{0}', String(publicationId)), options);
    return this.nav.searchPublications(url);
  }

  async searchSinglePub(pubTitle: string, filled: boolean = false): Promise<Publication> {
    const url = PUBSEARCH.replace('{0}', encodeURIComponent(pubTitle));
    return this.nav.searchPublication(url, filled);
  }

  searchAuthor(name: string): AsyncGenerator<Author> {
    const url = AUTHSEARCH.replace('{0}', encodeURIComponent(name));
    return this.nav.searchAuthors(url);
  }

  async fill(
    object: Author | Publication,
    sections: string[] = [],
    sortby: AuthorSortBy = 'citedby',
    publicationLimit: number = 0
  ): Promise<Author | Publication> {
    if (object.container_type === 'Author') {
      const authorParser = new AuthorParser(this.nav);
      const result = await authorParser.fill(object as Author, sections, sortby, publicationLimit);
      if (!result) {
        throw new Error('Incorrect input');
      }
      return result;
    } else if (object.container_type === 'Publication') {
      const publicationParser = new PublicationParser(this.nav);
      return publicationParser.fill(object as Publication);
    }

    throw new Error('Unknown container type');
  }

  async bibtex(publication: Publication): Promise<string> {
    if (publication.container_type === 'Publication') {
      const publicationParser = new PublicationParser(this.nav);
      return publicationParser.bibtex(publication);
    } else {
      console.warn('Object not supported for bibtex exportation');
      return '';
    }
  }

  async citedby(publication: Publication): Promise<SearchScholarIterator | undefined> {
    if (publication.container_type !== 'Publication') {
      console.warn('Object not supported for citedby');
      return undefined;
    }

    const publicationParser = new PublicationParser(this.nav);
    return publicationParser.citedby(publication);
  }

  async searchAuthorId(
    id: string,
    filled: boolean = false,
    sortby: AuthorSortBy = 'citedby',
    publicationLimit: number = 0
  ): Promise<Author> {
    return this.nav.searchAuthorId(id, filled, sortby, publicationLimit);
  }

  searchKeyword(keyword: string): AsyncGenerator<Author> {
    const regKeyword = keyword.replace(KEYWORDSEARCH_PATTERN, '_');
    const url = KEYWORDSEARCH.replace('{0}', encodeURIComponent(regKeyword));
    return this.nav.searchAuthors(url);
  }

  searchKeywords(keywords: string[]): AsyncGenerator<Author> {
    const regKeywords = keywords.map(k => k.replace(KEYWORDSEARCH_PATTERN, '_'));
    const formattedKeywords = regKeywords.map(k => `label:${encodeURIComponent(k)}`).join('+');
    const url = KEYWORDSEARCHBASE.replace('{}', formattedKeywords);
    return this.nav.searchAuthors(url);
  }

  searchPubsCustomUrl(url: string): SearchScholarIterator {
    return this.nav.searchPublications(url);
  }

  searchAuthorCustomUrl(url: string): AsyncGenerator<Author> {
    return this.nav.searchAuthors(url);
  }

  async getRelatedArticles(publication: Publication): Promise<SearchScholarIterator | undefined> {
    if (publication.container_type !== 'Publication') {
      console.warn('Not a publication object');
      return undefined;
    }

    if (publication.source === PublicationSource.AUTHOR_PUBLICATION_ENTRY) {
      if (!publication.url_related_articles) {
        const filled = (await this.fill(publication)) as Publication;
        return this.nav.searchPublications(filled.url_related_articles!);
      }
      return this.nav.searchPublications(publication.url_related_articles);
    } else if (publication.source === PublicationSource.PUBLICATION_SEARCH_SNIPPET) {
      return this.nav.searchPublications(publication.url_related_articles!);
    }

    return undefined;
  }

  pprint(object: Author | Publication): void {
    if (!object.container_type) {
      console.warn('Not a scholarly container object');
      return;
    }

    const toPrint = JSON.parse(JSON.stringify(object));

    if (toPrint.container_type === 'Publication') {
      toPrint.source = PublicationSource[toPrint.source as keyof typeof PublicationSource];
    } else if (toPrint.container_type === 'Author') {
      toPrint.source = toPrint.source;

      if (toPrint.coauthors) {
        for (const coauthor of toPrint.coauthors) {
          coauthor.filled = false;
          delete coauthor.container_type;
        }
      }

      if (toPrint.publications) {
        for (const publication of toPrint.publications) {
          publication.source = PublicationSource[publication.source as keyof typeof PublicationSource];
          delete publication.container_type;
        }
      }
    }

    delete toPrint.container_type;
    console.log(JSON.stringify(toPrint, null, 2));
  }

  async searchOrg(name: string, fromauthor: boolean = false): Promise<any[]> {
    const url = AUTHSEARCH.replace('{0}', encodeURIComponent(name));
    return this.nav.searchOrganization(url, fromauthor);
  }

  searchAuthorByOrganization(organizationId: number): AsyncGenerator<Author> {
    const url = ORGSEARCH.replace('{0}', String(organizationId));
    return this.nav.searchAuthors(url);
  }

  private constructUrl(
    baseurl: string,
    options: {
      patents?: boolean;
      citations?: boolean;
      yearLow?: number;
      yearHigh?: number;
      sortBy?: string;
      includeLastYear?: string;
      startIndex?: number;
    }
  ): string {
    const {
      patents = true,
      citations = true,
      yearLow,
      yearHigh,
      sortBy = 'relevance',
      includeLastYear = 'abstracts',
      startIndex = 0,
    } = options;

    let url = baseurl;

    const yrLo = yearLow !== undefined ? `&as_ylo=${yearLow}` : '';
    const yrHi = yearHigh !== undefined ? `&as_yhi=${yearHigh}` : '';
    const citationsParam = `&as_vis=${1 - (citations ? 1 : 0)}`;
    const patentsParam = `&as_sdt=${1 - (patents ? 1 : 0)},33`;
    let sortbyParam = '';
    const startParam = startIndex > 0 ? `&start=${startIndex}` : '';

    if (sortBy === 'date') {
      if (includeLastYear === 'abstracts') {
        sortbyParam = '&scisbd=1';
      } else if (includeLastYear === 'everything') {
        sortbyParam = '&scisbd=2';
      } else {
        console.warn(
          "Invalid option for 'includeLastYear', available options: 'everything', 'abstracts'"
        );
        return url;
      }
    } else if (sortBy !== 'relevance') {
      console.warn("Invalid option for 'sortBy', available options: 'relevance', 'date'");
      return url;
    }

    return url + yrLo + yrHi + citationsParam + patentsParam + sortbyParam + startParam;
  }

  async getJournalCategories(): Promise<{ [key: string]: any }> {
    if (this.journalCategories) {
      return this.journalCategories;
    }

    const $ = await this.nav.getSoup('/citations?view_op=top_venues&hl=en&vq=en');
    const categories: { [key: string]: any } = {};

    const categoryLinks = $('a.gs_md_li').toArray();
    for (const category of categoryLinks) {
      const $cat = $(category);
      const href = $cat.attr('href');
      if (href && href.includes('vq=')) {
        const vq = href.split('&vq=')[1];
        const text = $cat.text();
        categories[text] = { None: vq };
      }
    }

    this.journalCategories = categories;
    return categories;
  }

  async getJournals(
    category: string = 'English',
    subcategory?: string,
    includeComments: boolean = false
  ): Promise<{ [rank: number]: Journal }> {
    const categories = await this.getJournalCategories();

    if (!categories[category]) {
      throw new Error(`Invalid category: ${category}. Choose one from ${Object.keys(categories)}`);
    }

    const cat = categories[category];
    const subcat = cat[subcategory || 'None'];

    if (!subcat) {
      throw new Error(
        `Invalid subcategory: ${subcategory} for ${category}. Choose one from ${Object.keys(cat)}`
      );
    }

    const url = `/citations?view_op=top_venues&hl=en&vq=${subcat}`;
    const $ = await this.nav.getSoup(url);

    const ranks = $('.gsc_mvt_p').toArray();
    const names = $('.gsc_mvt_t').toArray();
    const h5indices = $('a.gs_ibl.gsc_mp_anchor').toArray();
    const h5medians = $('span.gs_ibl').toArray();

    const result: { [rank: number]: Journal } = {};

    for (let i = 0; i < ranks.length; i++) {
      const rank = parseInt($(ranks[i]).text().replace('.', ''));
      const name = $(names[i]).text();
      const h5index = parseInt($(h5indices[i]).text());
      const h5median = parseInt($(h5medians[i]).text());
      const urlCitations = $(h5indices[i]).attr('href') || '';

      let comment = '';
      if (includeComments && urlCitations) {
        // Fetch comments - simplified for now
        comment = '';
      }

      result[rank] = {
        name,
        h5_index: h5index,
        h5_median: h5median,
        url_citations: urlCitations,
        comment,
      };
    }

    return result;
  }
}

// Export singleton instance
export const scholarly = new Scholarly();

