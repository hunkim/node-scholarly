# node-scholarly

[![Feature Completeness](https://img.shields.io/badge/Feature%20Completeness-100%25-brightgreen)](./COMPARISON_REPORT.md)
[![npm version](https://img.shields.io/npm/v/node-scholarly.svg)](https://www.npmjs.com/package/node-scholarly)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

A Node.js/TypeScript library to retrieve author and publication information from [Google Scholar](https://scholar.google.com) in a friendly way without having to solve CAPTCHAs.

This is a **100% feature-complete** Node.js port of the Python [scholarly](https://github.com/scholarly-python-package/scholarly) package, providing full functionality for JavaScript/TypeScript projects. See [COMPARISON_REPORT.md](./COMPARISON_REPORT.md) for detailed feature comparison.

## Installation

```bash
npm install node-scholarly
```

## Features

### Core Features
- 🔍 Search for authors by name or keywords
- 📚 Search for publications by query
- 👤 Retrieve detailed author profiles
- 📄 Get publication details and citations
- 🔗 Find related articles and cited-by information
- 🌐 Support for proxy services (free proxies, ScraperAPI, Luminati)
- 📊 Access journal rankings and metrics
- 📖 Export citations in BibTeX format
- 🔄 Fully asynchronous API with TypeScript support

### Advanced Features (v1.1.0+)
- ✅ **Per-publication public access tracking** - Identify which papers comply with public access mandates
- ✅ **Funding mandate details** - Extract agency, policy URLs, effective dates, embargo periods, and grant IDs
- ✅ **Extended coauthors lists** - Fetch complete coauthor lists (>20) with automatic "View All" detection
- ✅ **Full feature parity** with Python scholarly package

## Quick Start

```typescript
import { scholarly } from 'node-scholarly';

// Search for an author
async function searchAuthor() {
  const searchQuery = scholarly.searchAuthor('Steven A Cholewiak');
  
  // Get first result
  for await (const author of searchQuery) {
    console.log(author);
    
    // Fill in author details
    const filledAuthor = await scholarly.fill(author);
    scholarly.pprint(filledAuthor);
    
    break; // Just get first result
  }
}

// Search for publications
async function searchPublications() {
  const searchQuery = await scholarly.searchPubs('Machine Learning');
  
  let pub = await searchQuery.next();
  if (pub) {
    console.log(pub);
    
    // Get full publication details
    const filledPub = await scholarly.fill(pub);
    scholarly.pprint(filledPub);
    
    // Get BibTeX citation
    const bibtex = await scholarly.bibtex(filledPub);
    console.log(bibtex);
  }
}

searchAuthor();
searchPublications();
```

## API Reference

### Searching

#### `searchAuthor(name: string)`
Search for authors by name.

```typescript
const authors = scholarly.searchAuthor('Albert Einstein');
for await (const author of authors) {
  console.log(author.name, author.affiliation);
}
```

#### `searchKeyword(keyword: string)`
Search for authors by a single keyword.

```typescript
const authors = scholarly.searchKeyword('machine learning');
for await (const author of authors) {
  console.log(author);
}
```

#### `searchKeywords(keywords: string[])`
Search for authors by multiple keywords.

```typescript
const authors = scholarly.searchKeywords(['machine learning', 'neural networks']);
for await (const author of authors) {
  console.log(author);
}
```

#### `searchPubs(query: string, options?)`
Search for publications.

```typescript
const pubs = await scholarly.searchPubs('quantum computing', {
  patents: false,
  citations: true,
  yearLow: 2020,
  yearHigh: 2024,
  sortBy: 'date'
});

let pub = await pubs.next();
while (pub) {
  console.log(pub.bib.title);
  pub = await pubs.next();
}
```

#### `searchAuthorId(id: string, filled?, sortby?, publicationLimit?)`
Get author by Google Scholar ID.

```typescript
// Get author with basic info only
const author = await scholarly.searchAuthorId('JE_m2UgAAAAJ');

// Get author with all details filled
const filledAuthor = await scholarly.searchAuthorId('JE_m2UgAAAAJ', true);

// Get author with publications sorted by date, limited to 50
const authorByDate = await scholarly.searchAuthorId('JE_m2UgAAAAJ', true, 'date', 50);

scholarly.pprint(authorByDate);
```

### Filling Details

#### `fill(object: Author | Publication, sections?, sortby?, publicationLimit?)`
Fill in complete details for an author or publication.

```typescript
// Fill author with all details
const filledAuthor = await scholarly.fill(author);

// Fill only specific sections
const partialAuthor = await scholarly.fill(author, ['basics', 'indices', 'counts']);

// Fill author publications sorted by citations (default)
const authorWithPubs = await scholarly.fill(author, ['publications'], 'citedby', 20);

// Fill author publications sorted by date (most recent first)
const authorByDate = await scholarly.fill(author, ['publications'], 'date', 20);
```

**Available sections for authors:**
- `basics` - name, affiliation, interests
- `indices` - h-index, i10-index, etc.
- `counts` - citations per year
- `coauthors` - list of co-authors
- `publications` - list of publications
- `public_access` - public access mandates info

**Available sort options for publications:**
- `'citedby'` - Sort by number of citations (default, most cited first)
- `'year'` - Sort by publication year (most recent first)
- `'date'` - Alias for 'year'
- `'pubdate'` - Alias for 'year'

**⚠️ Important: Multiple Fill Calls**

Once a section is filled, subsequent `fill()` calls for the same section will be **skipped**. If you need to fetch publications with different sort orders, fetch the author separately for each operation:

```typescript
// ❌ WRONG - Second fill() will be skipped!
const author = await scholarly.searchAuthorId('ABC123');
const byCitations = await scholarly.fill(author, ['publications'], 'citedby', 6);
const byDate = await scholarly.fill(author, ['publications'], 'date', 6); // Skipped!

// ✅ CORRECT - Fetch author separately for each sort order
const authorForCited = await scholarly.searchAuthorId('ABC123');
const byCitations = await scholarly.fill(authorForCited, ['publications'], 'citedby', 6);

const authorForRecent = await scholarly.searchAuthorId('ABC123');
const byDate = await scholarly.fill(authorForRecent, ['publications'], 'date', 6);
```

### Citations and Related

#### `citedby(publication: Publication)`
Get publications that cite the given publication.

```typescript
const citations = await scholarly.citedby(publication);
let citation = await citations.next();
while (citation) {
  console.log(citation.bib.title);
  citation = await citations.next();
}
```

#### `getRelatedArticles(publication: Publication)`
Get related articles for a publication.

```typescript
const related = await scholarly.getRelatedArticles(publication);
let article = await related.next();
while (article) {
  console.log(article.bib.title);
  article = await related.next();
}
```

#### `bibtex(publication: Publication)`
Get BibTeX citation for a publication.

```typescript
const bibtex = await scholarly.bibtex(publication);
console.log(bibtex);
```

### Organizations and Journals

#### `searchOrg(name: string)`
Search for organizations.

```typescript
const orgs = await scholarly.searchOrg('MIT');
console.log(orgs);
```

#### `searchAuthorByOrganization(orgId: number)`
Get authors from an organization.

```typescript
const authors = scholarly.searchAuthorByOrganization(12345);
for await (const author of authors) {
  console.log(author);
}
```

#### `getJournals(category?, subcategory?, includeComments?)`
Get journal rankings.

```typescript
const journals = await scholarly.getJournals('Engineering & Computer Science', 'Artificial Intelligence');
console.log(journals);
```

### Utilities

#### `pprint(object: Author | Publication)`
Pretty print an author or publication.

```typescript
scholarly.pprint(author);
scholarly.pprint(publication);
```

## Using Proxies

To avoid getting blocked by Google Scholar, it's recommended to use proxies:

### Free Proxies (Not Recommended for Production)

```typescript
import { scholarly, ProxyGenerator } from 'node-scholarly';

const pg = new ProxyGenerator();
// Note: Free proxies are unreliable and slow
scholarly.useProxy(pg);
```

### ScraperAPI (Recommended)

```typescript
import { scholarly, ProxyGenerator } from 'node-scholarly';

const pg = new ProxyGenerator();
await pg.ScraperAPI('YOUR_SCRAPER_API_KEY');
scholarly.useProxy(pg);
```

### Luminati (Bright Data)

```typescript
import { scholarly, ProxyGenerator } from 'node-scholarly';

const pg = new ProxyGenerator();
await pg.Luminati('username', 'password', 22225);
scholarly.useProxy(pg);
```

### Single Proxy

```typescript
import { scholarly, ProxyGenerator } from 'node-scholarly';

const pg = new ProxyGenerator();
await pg.SingleProxy('http://proxy.example.com:8080');
scholarly.useProxy(pg);
```

## Configuration

### Set Timeout

```typescript
scholarly.setTimeout(10000); // 10 seconds
```

### Set Retries

```typescript
scholarly.setRetries(10);
```

## TypeScript Support

This library is written in TypeScript and provides full type definitions:

```typescript
import { Author, Publication, Journal } from 'node-scholarly';

const author: Author = await scholarly.searchAuthorId('EmD_lTEAAAAJ');
const publication: Publication = await scholarly.searchSinglePub('Machine Learning');
```

## Examples

See the `examples/` directory for more detailed examples:

- `basic-usage.ts` - Basic search and retrieval
- `with-proxy.ts` - Using proxies
- `citations.ts` - Working with citations
- `journals.ts` - Getting journal rankings

## Limitations

- Google Scholar may block requests if too many are made without proxies
- CAPTCHAs may appear and require manual intervention
- Some features may not work without a premium proxy service

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is released under the [Unlicense](http://unlicense.org/), keeping with the spirit of the original Python scholarly package.

## Acknowledgments

This is a Node.js/TypeScript port of the Python [scholarly](https://github.com/scholarly-python-package/scholarly) package. All credit for the original design and implementation goes to the scholarly-python-package team.

## Citation

If you use this library in academic work, please cite the original scholarly package:

```bibtex
@software{cholewiak2021scholarly,
  author = {Cholewiak, Steven A. and Ipeirotis, Panos and Silva, Victor and Kannawadi, Arun},
  title = {{scholarly: Simple access to Google Scholar authors and citation using Python}},
  year = {2021},
  doi = {10.5281/zenodo.5764801},
  license = {Unlicense},
  url = {https://github.com/scholarly-python-package/scholarly},
  version = {1.5.1}
}
```

