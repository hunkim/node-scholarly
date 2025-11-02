/**
 * Example of using node-scholarly with proxy services
 */

import { scholarly, ProxyGenerator } from '../src';

async function withScraperAPI() {
  console.log('=== Using ScraperAPI ===');
  
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) {
    console.log('SCRAPER_API_KEY not found in environment variables');
    return;
  }
  
  const pg = new ProxyGenerator();
  const success = await pg.ScraperAPI(apiKey);
  
  if (success) {
    scholarly.useProxy(pg);
    console.log('Proxy set up successfully!');
    
    // Now search with proxy
    const searchQuery = scholarly.searchAuthor('Andrew Ng');
    for await (const author of searchQuery) {
      console.log('Author:', author.name);
      console.log('Affiliation:', author.affiliation);
      break;
    }
  } else {
    console.log('Failed to set up proxy');
  }
}

async function withLuminati() {
  console.log('\n=== Using Luminati (Bright Data) ===');
  
  const username = process.env.LUMINATI_USERNAME;
  const password = process.env.LUMINATI_PASSWORD;
  const port = process.env.LUMINATI_PORT;
  
  if (!username || !password || !port) {
    console.log('Luminati credentials not found in environment variables');
    return;
  }
  
  const pg = new ProxyGenerator();
  const success = await pg.Luminati(username, password, parseInt(port));
  
  if (success) {
    scholarly.useProxy(pg);
    console.log('Proxy set up successfully!');
    
    // Now search with proxy
    const pubs = await scholarly.searchPubs('deep learning');
    const pub = await pubs.next();
    if (pub) {
      console.log('Publication:', pub.bib.title);
    }
  } else {
    console.log('Failed to set up proxy');
  }
}

async function withSingleProxy() {
  console.log('\n=== Using Single Proxy ===');
  
  const proxyUrl = process.env.PROXY_URL;
  if (!proxyUrl) {
    console.log('PROXY_URL not found in environment variables');
    return;
  }
  
  const pg = new ProxyGenerator();
  const success = await pg.SingleProxy(proxyUrl);
  
  if (success) {
    scholarly.useProxy(pg);
    console.log('Proxy set up successfully!');
    
    // Now search with proxy
    const searchQuery = scholarly.searchKeyword('computer vision');
    for await (const author of searchQuery) {
      console.log('Author:', author.name);
      console.log('Interests:', author.interests?.join(', '));
      break;
    }
  } else {
    console.log('Failed to set up proxy');
  }
}

async function main() {
  try {
    scholarly.setTimeout(60000); // Longer timeout for proxy requests
    scholarly.setRetries(5);
    
    await withScraperAPI();
    await withLuminati();
    await withSingleProxy();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

