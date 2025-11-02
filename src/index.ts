/**
 * node-scholarly - Node.js library to retrieve author and publication information from Google Scholar
 */

export { scholarly, Scholarly } from './scholarly';
export { ProxyGenerator } from './proxyGenerator';
export {
  Author,
  Publication,
  Journal,
  BibEntry,
  Mandate,
  PublicAccess,
  CitesPerYear,
  AuthorSource,
  PublicationSource,
  ProxyMode,
  DOSException,
  MaxTriesExceededException,
} from './dataTypes';
export { SearchScholarIterator } from './publicationParser';

