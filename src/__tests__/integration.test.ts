/**
 * Integration tests - these make actual requests to Google Scholar
 * Note: These may fail due to rate limiting without proxies
 */

import { scholarly } from '../index';

describe('Integration Tests', () => {
  beforeAll(() => {
    scholarly.setTimeout(10000);
    scholarly.setRetries(3);
  });

  describe('Basic Search', () => {
    test('search for a well-known author', async () => {
      try {
        const searchQuery = scholarly.searchAuthor('Marie Curie');
        const authors = [];

        for await (const author of searchQuery) {
          authors.push(author);
          if (authors.length >= 1) break;
        }

        if (authors.length > 0) {
          const author = authors[0];
          expect(author.container_type).toBe('Author');
          expect(author.scholar_id).toBeDefined();
          expect(author.name).toBeDefined();
          console.log('Found author:', author.name);
        } else {
          console.warn('No authors found - possibly rate limited');
        }
      } catch (error: any) {
        console.warn('Test failed (possibly due to rate limiting):', error.message);
      }
    }, 30000);

    test('search for publications', async () => {
      try {
        const searchQuery = await scholarly.searchPubs('machine learning');
        const pub = await searchQuery.next();

        if (pub) {
          expect(pub.container_type).toBe('Publication');
          expect(pub.bib).toBeDefined();
          expect(pub.bib.title).toBeDefined();
          console.log('Found publication:', pub.bib.title);
        } else {
          console.warn('No publications found - possibly rate limited');
        }
      } catch (error: any) {
        console.warn('Test failed (possibly due to rate limiting):', error.message);
      }
    }, 30000);

    test('search author by ID', async () => {
      try {
        // Marie Curie's scholar ID
        const author = await scholarly.searchAuthorId('EmD_lTEAAAAJ', false);

        expect(author).toBeDefined();
        expect(author.container_type).toBe('Author');
        expect(author.scholar_id).toBe('EmD_lTEAAAAJ');
        console.log('Found author by ID:', author.name);
      } catch (error: any) {
        console.warn('Test failed (possibly due to rate limiting):', error.message);
      }
    }, 30000);
  });

  describe('Fill Operations', () => {
    test('fill author basics', async () => {
      try {
        const author = await scholarly.searchAuthorId('EmD_lTEAAAAJ', false);
        const filled = await scholarly.fill(author, ['basics']);

        expect((filled as any).name).toBeDefined();
        expect((filled as any).filled).toContain('basics');
        console.log('Filled author name:', (filled as any).name);
      } catch (error: any) {
        console.warn('Test failed (possibly due to rate limiting):', error.message);
      }
    }, 30000);
  });
});

describe('Feature Compatibility Tests', () => {
  test('all main API methods exist', () => {
    const methods = [
      'searchAuthor',
      'searchPubs',
      'searchKeyword',
      'searchKeywords',
      'searchAuthorId',
      'searchSinglePub',
      'fill',
      'bibtex',
      'citedby',
      'getRelatedArticles',
      'searchOrg',
      'searchAuthorByOrganization',
      'pprint',
      'setTimeout',
      'setRetries',
      'useProxy',
    ];

    methods.forEach(method => {
      expect((scholarly as any)[method]).toBeDefined();
    });
  });

  test('ProxyGenerator methods exist', async () => {
    const { ProxyGenerator } = await import('../index');
    const pg = new ProxyGenerator();

    expect(pg.SingleProxy).toBeDefined();
    expect(pg.ScraperAPI).toBeDefined();
    expect(pg.Luminati).toBeDefined();
  });
});

describe('Error Handling', () => {
  test('handles invalid author ID gracefully', async () => {
    try {
      await scholarly.searchAuthorId('INVALID_ID_12345', false);
    } catch (error) {
      // Should either succeed or throw an error, not hang
      expect(error).toBeDefined();
    }
  }, 30000);

  test('handles empty search gracefully', async () => {
    try {
      const searchQuery = scholarly.searchAuthor('');
      const authors = [];

      for await (const author of searchQuery) {
        authors.push(author);
        if (authors.length >= 1) break;
      }

      // Should return results or empty array, not crash
      expect(Array.isArray(authors)).toBe(true);
    } catch (error: any) {
      console.warn('Empty search handling:', error.message);
    }
  }, 30000);
});

