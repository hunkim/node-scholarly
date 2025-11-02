/**
 * Smoke tests for basic functionality
 */

import { scholarly, ProxyGenerator } from '../index';

describe('Smoke Tests - Basic Functionality', () => {
  test('scholarly exports are available', () => {
    expect(scholarly).toBeDefined();
    expect(scholarly.searchAuthor).toBeDefined();
    expect(scholarly.searchPubs).toBeDefined();
    expect(scholarly.fill).toBeDefined();
  });

  test('ProxyGenerator can be instantiated', () => {
    const pg = new ProxyGenerator();
    expect(pg).toBeDefined();
  });

  test('scholarly configuration methods work', () => {
    expect(() => scholarly.setTimeout(5000)).not.toThrow();
    expect(() => scholarly.setRetries(3)).not.toThrow();
  });

  test('searchAuthor returns an async iterator', () => {
    const result = scholarly.searchAuthor('test');
    expect(result).toBeDefined();
    expect(typeof result[Symbol.asyncIterator]).toBe('function');
  });

  test('searchPubs returns a promise', async () => {
    const result = scholarly.searchPubs('test');
    expect(result).toBeInstanceOf(Promise);
  });

  test('pprint does not throw on valid objects', () => {
    const mockAuthor = {
      container_type: 'Author' as const,
      scholar_id: 'test123',
      filled: [],
      source: 'SEARCH_AUTHOR_SNIPPETS' as any,
      name: 'Test Author',
    };
    
    expect(() => scholarly.pprint(mockAuthor)).not.toThrow();
  });
});

describe('Smoke Tests - Data Types', () => {
  test('Author object structure', () => {
    const mockAuthor = {
      container_type: 'Author' as const,
      scholar_id: 'test123',
      filled: [],
      source: 'SEARCH_AUTHOR_SNIPPETS' as any,
    };

    expect(mockAuthor.container_type).toBe('Author');
    expect(mockAuthor.scholar_id).toBe('test123');
    expect(Array.isArray(mockAuthor.filled)).toBe(true);
  });

  test('Publication object structure', () => {
    const mockPub = {
      container_type: 'Publication' as const,
      bib: {
        title: 'Test Publication',
      },
      filled: false,
      source: 'PUBLICATION_SEARCH_SNIPPET' as any,
    };

    expect(mockPub.container_type).toBe('Publication');
    expect(mockPub.bib.title).toBe('Test Publication');
    expect(mockPub.filled).toBe(false);
  });
});

describe('Smoke Tests - URL Construction', () => {
  test('searchKeyword constructs valid iterator', () => {
    const result = scholarly.searchKeyword('machine learning');
    expect(result).toBeDefined();
    expect(typeof result[Symbol.asyncIterator]).toBe('function');
  });

  test('searchKeywords constructs valid iterator', () => {
    const result = scholarly.searchKeywords(['machine learning', 'AI']);
    expect(result).toBeDefined();
    expect(typeof result[Symbol.asyncIterator]).toBe('function');
  });

  test('searchPubsCustomUrl accepts custom URL', () => {
    const result = scholarly.searchPubsCustomUrl('/scholar?q=test');
    expect(result).toBeDefined();
  });
});

