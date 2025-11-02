/**
 * Basic usage examples for node-scholarly
 */

import { scholarly } from '../src';

async function searchAuthorExample() {
  console.log('=== Searching for Author ===');
  
  const searchQuery = scholarly.searchAuthor('Steven A Cholewiak');
  
  for await (const author of searchQuery) {
    console.log('\nAuthor found:');
    scholarly.pprint(author);
    
    // Fill in complete details
    const filledAuthor = await scholarly.fill(author);
    console.log('\nAuthor with full details:');
    scholarly.pprint(filledAuthor);
    
    break; // Just get first result
  }
}

async function searchPublicationExample() {
  console.log('\n=== Searching for Publications ===');
  
  const searchQuery = await scholarly.searchPubs('machine learning');
  
  let pub = await searchQuery.next();
  if (pub) {
    console.log('\nPublication found:');
    scholarly.pprint(pub);
    
    // Get full publication details
    const filledPub = await scholarly.fill(pub);
    console.log('\nPublication with full details:');
    scholarly.pprint(filledPub);
    
    // Get BibTeX citation
    console.log('\nBibTeX citation:');
    const bibtex = await scholarly.bibtex(filledPub);
    console.log(bibtex);
  }
}

async function searchByIdExample() {
  console.log('\n=== Search Author by ID ===');
  
  // Example Google Scholar ID
  const author = await scholarly.searchAuthorId('JE_m2UgAAAAJ', true);
  
  console.log('\nAuthor details:');
  scholarly.pprint(author);
}

async function citationsExample() {
  console.log('\n=== Getting Citations ===');
  
  const searchQuery = await scholarly.searchPubs('attention is all you need');
  let pub = await searchQuery.next();
  
  if (pub && pub.num_citations && pub.num_citations > 0) {
    console.log(`\nPublication has ${pub.num_citations} citations`);
    
    const citations = await scholarly.citedby(pub);
    if (citations) {
      console.log('\nFirst 3 citing papers:');
      let count = 0;
      let citation = await citations.next();
      
      while (citation && count < 3) {
        console.log(`${count + 1}. ${citation.bib.title}`);
        count++;
        citation = await citations.next();
      }
    }
  }
}

async function main() {
  try {
    // Set timeout and retries
    scholarly.setTimeout(10000);
    scholarly.setRetries(5);
    
    await searchAuthorExample();
    await searchPublicationExample();
    await searchByIdExample();
    await citationsExample();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

