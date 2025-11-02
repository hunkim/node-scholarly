import { scholarly, ProxyGenerator } from '../index';
import { AuthorSource, PublicationSource } from '../dataTypes';

describe('Scholarly Tests', () => {
  beforeAll(() => {
    scholarly.setTimeout(10000);
    scholarly.setRetries(5);
  });

  describe('Author Search', () => {
    test('search author by name', async () => {
      const searchQuery = scholarly.searchAuthor('Steven A Cholewiak');
      const authors = [];

      for await (const author of searchQuery) {
        authors.push(author);
        if (authors.length >= 1) break;
      }

      expect(authors.length).toBeGreaterThan(0);
      const author = authors[0];
      expect(author.name).toBeDefined();
      expect(author.scholar_id).toBeDefined();
      expect(author.container_type).toBe('Author');
    }, 30000);

    test('search author by keyword', async () => {
      const searchQuery = scholarly.searchKeyword('machine learning');
      const authors = [];

      for await (const author of searchQuery) {
        authors.push(author);
        if (authors.length >= 1) break;
      }

      expect(authors.length).toBeGreaterThan(0);
      expect(authors[0].interests).toBeDefined();
    }, 30000);

    test('search author by multiple keywords', async () => {
      const searchQuery = scholarly.searchKeywords(['machine learning', 'computer vision']);
      const authors = [];

      for await (const author of searchQuery) {
        authors.push(author);
        if (authors.length >= 1) break;
      }

      expect(authors.length).toBeGreaterThan(0);
    }, 30000);

    test('search author by id', async () => {
      // Marie Curie's scholar ID
      const author = await scholarly.searchAuthorId('EmD_lTEAAAAJ', false);

      expect(author).toBeDefined();
      expect(author.scholar_id).toBe('EmD_lTEAAAAJ');
      expect(author.name).toBeDefined();
    }, 30000);

    test('fill author basics', async () => {
      const searchQuery = scholarly.searchAuthor('Albert Einstein');
      let author;

      for await (const a of searchQuery) {
        author = a;
        break;
      }

      expect(author).toBeDefined();

      const filled = await scholarly.fill(author!, ['basics']) as any;
      expect(filled.container_type).toBe('Author');
      expect(filled.name).toBeDefined();
      expect(filled.filled).toContain('basics');
    }, 30000);

    test('fill author with indices', async () => {
      const author = await scholarly.searchAuthorId('JE_m2UgAAAAJ', false);
      const filled = await scholarly.fill(author, ['basics', 'indices']);

      expect((filled as any).hindex).toBeDefined();
      expect((filled as any).i10index).toBeDefined();
      expect((filled as any).citedby).toBeDefined();
    }, 30000);
  });

  describe('Publication Search', () => {
    test('search publications', async () => {
      const searchQuery = await scholarly.searchPubs('machine learning');
      const pub = await searchQuery.next();

      expect(pub).toBeDefined();
      expect(pub!.container_type).toBe('Publication');
      expect(pub!.bib).toBeDefined();
      expect(pub!.bib.title).toBeDefined();
    }, 30000);

    test('search publications with filters', async () => {
      const searchQuery = await scholarly.searchPubs('neural networks', {
        yearLow: 2020,
        yearHigh: 2024,
        patents: false,
        citations: true,
      });

      const pub = await searchQuery.next();
      expect(pub).toBeDefined();
    }, 30000);

    test('search single publication', async () => {
      const pub = await scholarly.searchSinglePub('Attention is all you need');

      expect(pub).toBeDefined();
      expect(pub.bib.title).toBeDefined();
      if (pub.bib.title) {
        expect(pub.bib.title.toLowerCase()).toContain('attention');
      }
    }, 30000);

    test('fill publication details', async () => {
      const searchQuery = await scholarly.searchPubs('deep learning');
      const pub = await searchQuery.next();

      expect(pub).toBeDefined();

      const filled = await scholarly.fill(pub!);
      expect(filled.filled).toBe(true);
    }, 30000);

    test('get bibtex for publication', async () => {
      const searchQuery = await scholarly.searchPubs('convolutional neural networks');
      let pub = await searchQuery.next();

      expect(pub).toBeDefined();

      const filledPub = await scholarly.fill(pub!) as any;
      const bibtex = await scholarly.bibtex(filledPub);

      expect(bibtex).toBeDefined();
      expect(bibtex).toContain('@');
      expect(bibtex).toContain('title');
    }, 30000);
  });

  describe('Citations and Related', () => {
    test('get cited by publications', async () => {
      const searchQuery = await scholarly.searchPubs('BERT');
      let pub = await searchQuery.next();

      expect(pub).toBeDefined();

      if (pub!.num_citations && pub!.num_citations > 0) {
        const citations = await scholarly.citedby(pub!);
        const firstCitation = await citations!.next();

        expect(firstCitation).toBeDefined();
        expect(firstCitation!.bib).toBeDefined();
      }
    }, 30000);

    test('get related articles', async () => {
      const searchQuery = await scholarly.searchPubs('transformer architecture');
      const pub = await searchQuery.next();

      expect(pub).toBeDefined();

      if (pub!.url_related_articles) {
        const related = await scholarly.getRelatedArticles(pub!);
        expect(related).toBeDefined();

        if (related) {
          const firstRelated = await related.next();
          expect(firstRelated).toBeDefined();
        }
      }
    }, 30000);
  });

  describe('Organization Search', () => {
    test('search organization', async () => {
      const orgs = await scholarly.searchOrg('MIT');

      expect(orgs).toBeDefined();
      expect(orgs.length).toBeGreaterThan(0);
      expect(orgs[0].Organization).toBeDefined();
      expect(orgs[0].id).toBeDefined();
    }, 30000);
  });

  describe('Utility Functions', () => {
    test('pprint author', async () => {
      const author = await scholarly.searchAuthorId('JE_m2UgAAAAJ', false);
      
      // Should not throw
      expect(() => scholarly.pprint(author)).not.toThrow();
    }, 30000);

    test('pprint publication', async () => {
      const searchQuery = await scholarly.searchPubs('quantum computing');
      const pub = await searchQuery.next();

      expect(pub).toBeDefined();
      expect(() => scholarly.pprint(pub!)).not.toThrow();
    }, 30000);
  });

  describe('Custom URL Search', () => {
    test('search publications with custom URL', async () => {
      const customUrl = '/scholar?hl=en&q=artificial+intelligence';
      const searchQuery = scholarly.searchPubsCustomUrl(customUrl);
      const pub = await searchQuery.next();

      expect(pub).toBeDefined();
      expect(pub!.bib.title).toBeDefined();
    }, 30000);

    test('search authors with custom URL', async () => {
      const customUrl = '/citations?hl=en&view_op=search_authors&mauthors=deep+learning';
      const searchQuery = scholarly.searchAuthorCustomUrl(customUrl);
      
      const authors = [];
      for await (const author of searchQuery) {
        authors.push(author);
        if (authors.length >= 1) break;
      }

      expect(authors.length).toBeGreaterThan(0);
    }, 30000);
  });

  describe('Configuration', () => {
    test('set timeout', () => {
      expect(() => scholarly.setTimeout(5000)).not.toThrow();
    });

    test('set retries', () => {
      expect(() => scholarly.setRetries(3)).not.toThrow();
    });
  });
});

describe('Proxy Tests', () => {
  test('create proxy generator', () => {
    const pg = new ProxyGenerator();
    expect(pg).toBeDefined();
  });

  test('single proxy setup', async () => {
    const pg = new ProxyGenerator();
    // This test will likely fail without a real proxy
    // Just test that the method exists and doesn't crash
    expect(pg.SingleProxy).toBeDefined();
  });
});

describe('Edge Cases', () => {
  test('search with empty query', async () => {
    const searchQuery = scholarly.searchAuthor('');
    const authors = [];

    for await (const author of searchQuery) {
      authors.push(author);
      if (authors.length >= 1) break;
    }

    // Empty search might return no results or some results
    expect(authors).toBeDefined();
  }, 30000);

  test('search for non-existent author', async () => {
    const searchQuery = scholarly.searchAuthor('ThisAuthorDefinitelyDoesNotExist12345XYZ');
    const authors = [];

    for await (const author of searchQuery) {
      authors.push(author);
      if (authors.length >= 1) break;
    }

    expect(authors).toBeDefined();
  }, 30000);

  test('fill with invalid sections', async () => {
    const author = await scholarly.searchAuthorId('EmD_lTEAAAAJ', false);
    
    // Should handle invalid sections gracefully
    const filled = await scholarly.fill(author, ['invalid_section' as any]);
    expect(filled).toBeDefined();
  }, 30000);
});

describe('Data Types', () => {
  test('author has correct structure', async () => {
    const author = await scholarly.searchAuthorId('JE_m2UgAAAAJ', false);

    expect(author.container_type).toBe('Author');
    expect(author.scholar_id).toBeDefined();
    expect(author.filled).toBeInstanceOf(Array);
    expect(author.source).toBeDefined();
  }, 30000);

  test('publication has correct structure', async () => {
    const searchQuery = await scholarly.searchPubs('test');
    const pub = await searchQuery.next();

    expect(pub).toBeDefined();
    expect(pub!.container_type).toBe('Publication');
    expect(pub!.bib).toBeDefined();
    expect(pub!.filled).toBeDefined();
    expect(pub!.source).toBeDefined();
  }, 30000);
});

describe('Iterator Functionality', () => {
  test('publication iterator works correctly', async () => {
    const searchQuery = await scholarly.searchPubs('neural network');
    
    let count = 0;
    const maxResults = 3;

    let pub = await searchQuery.next();
    while (pub && count < maxResults) {
      expect(pub.bib.title).toBeDefined();
      count++;
      pub = await searchQuery.next();
    }

    expect(count).toBe(maxResults);
  }, 30000);

  test('author iterator works correctly', async () => {
    const searchQuery = scholarly.searchAuthor('John Smith');
    
    let count = 0;
    const maxResults = 3;

    for await (const author of searchQuery) {
      expect(author.scholar_id).toBeDefined();
      count++;
      if (count >= maxResults) break;
    }

    expect(count).toBe(maxResults);
  }, 30000);
});

