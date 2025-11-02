/**
 * Data types for the scholarly library
 */

export enum PublicationSource {
  PUBLICATION_SEARCH_SNIPPET = 'PUBLICATION_SEARCH_SNIPPET',
  AUTHOR_PUBLICATION_ENTRY = 'AUTHOR_PUBLICATION_ENTRY',
  JOURNAL_CITATION_LIST = 'JOURNAL_CITATION_LIST',
}

export enum AuthorSource {
  AUTHOR_PROFILE_PAGE = 'AUTHOR_PROFILE_PAGE',
  SEARCH_AUTHOR_SNIPPETS = 'SEARCH_AUTHOR_SNIPPETS',
  CO_AUTHORS_LIST = 'CO_AUTHORS_LIST',
}

export enum ProxyMode {
  FREE_PROXIES = 'FREE_PROXIES',
  SCRAPERAPI = 'SCRAPERAPI',
  LUMINATI = 'LUMINATI',
  SINGLEPROXY = 'SINGLEPROXY',
  TOR_EXTERNAL = 'TOR_EXTERNAL',
  TOR_INTERNAL = 'TOR_INTERNAL',
}

export type CitesPerYear = { [year: number]: number };

export interface PublicAccess {
  available: number;
  not_available: number;
}

export interface BibEntry {
  pub_type?: string;
  bib_id?: string;
  abstract?: string;
  title?: string;
  author?: string | string[];
  pub_year?: string;
  venue?: string;
  journal?: string;
  conference?: string;
  volume?: string;
  number?: string;
  pages?: string;
  publisher?: string;
  citation?: string;
}

export interface Mandate {
  agency?: string;
  url_policy?: string;
  url_policy_cached?: string;
  effective_date?: string;
  embargo?: string;
  acknowledgement?: string;
  grant?: string;
}

export interface Publication {
  container_type: 'Publication';
  bib: BibEntry;
  gsrank?: number;
  author_id?: string[];
  num_citations?: number;
  cites_id?: string[];
  citedby_url?: string;
  cites_per_year?: CitesPerYear;
  author_pub_id?: string;
  public_access?: boolean;
  mandates?: Mandate[];
  eprint_url?: string;
  pub_url?: string;
  url_add_sclib?: string;
  url_related_articles?: string;
  url_scholarbib?: string;
  filled: boolean;
  source: PublicationSource;
}

export interface Author {
  container_type: 'Author';
  scholar_id: string;
  name?: string;
  affiliation?: string;
  organization?: number;
  email_domain?: string;
  url_picture?: string;
  homepage?: string;
  citedby?: number;
  filled: string[];
  interests?: string[];
  citedby5y?: number;
  hindex?: number;
  hindex5y?: number;
  i10index?: number;
  i10index5y?: number;
  cites_per_year?: CitesPerYear;
  public_access?: PublicAccess;
  publications?: Publication[];
  coauthors?: Author[];
  source: AuthorSource;
}

export interface Journal {
  name: string;
  h5_index: number;
  h5_median: number;
  url_citations: string;
  comment?: string;
}

export class DOSException extends Error {
  constructor(message = 'DOS attack was detected') {
    super(message);
    this.name = 'DOSException';
  }
}

export class MaxTriesExceededException extends Error {
  constructor(message = 'Maximum number of tries exceeded') {
    super(message);
    this.name = 'MaxTriesExceededException';
  }
}

