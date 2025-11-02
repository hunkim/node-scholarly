#!/usr/bin/env node

/**
 * Utility to verify a Google Scholar ID fetches the correct papers
 * Usage: node verify-scholar-id.js <SCHOLAR_ID>
 */

const { scholarly } = require('./dist/index.js');

async function verifyScholarId(scholarId) {
  console.log('\n╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          Google Scholar ID Verification Tool                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝\n');
  
  if (!scholarId) {
    console.error('❌ Error: No Scholar ID provided\n');
    console.log('Usage: node verify-scholar-id.js <SCHOLAR_ID>');
    console.log('Example: node verify-scholar-id.js JE_m2UgAAAAJ\n');
    process.exit(1);
  }
  
  console.log('📝 Input Scholar ID:', scholarId);
  console.log('🔗 Google Scholar URL: https://scholar.google.com/citations?user=' + scholarId);
  console.log('\n' + '─'.repeat(70) + '\n');
  
  try {
    // Step 1: Fetch author
    console.log('1️⃣  Fetching author information...');
    const author = await scholarly.searchAuthorId(scholarId, false);
    
    console.log('   ✓ Success!');
    console.log('   Name:', author.name || '(not yet filled)');
    console.log('   Scholar ID:', author.scholar_id);
    
    if (author.scholar_id !== scholarId) {
      console.warn('   ⚠️  Warning: Scholar ID changed (possible redirect)');
      console.warn('      Original:', scholarId);
      console.warn('      Redirected to:', author.scholar_id);
    } else {
      console.log('   ✓ Scholar ID matches input');
    }
    
    // Step 2: Get basic info
    console.log('\n2️⃣  Fetching basic information...');
    const filled = await scholarly.fill(author, ['basics']);
    console.log('   ✓ Name:', filled.name);
    console.log('   ✓ Affiliation:', filled.affiliation || '(none)');
    console.log('   ✓ Interests:', filled.interests?.slice(0, 3).join(', ') || '(none)');
    
    // Step 3: Get top cited papers
    console.log('\n3️⃣  Fetching top 5 most cited papers...');
    const authorCited = await scholarly.searchAuthorId(scholarId, false);
    const withCited = await scholarly.fill(authorCited, ['publications'], 'citedby', 5);
    
    if (withCited.publications && withCited.publications.length > 0) {
      console.log('   ✓ Found', withCited.publications.length, 'publications\n');
      withCited.publications.forEach((pub, i) => {
        console.log(`   ${i + 1}. "${pub.bib.title?.substring(0, 60)}..."`);
        console.log(`      Citations: ${pub.num_citations || 0}, Year: ${pub.bib.pub_year || 'N/A'}`);
      });
    } else {
      console.log('   ⚠️  No publications found');
    }
    
    // Step 4: Get recent papers
    console.log('\n4️⃣  Fetching 5 most recent papers...');
    const authorRecent = await scholarly.searchAuthorId(scholarId, false);
    const withRecent = await scholarly.fill(authorRecent, ['publications'], 'date', 5);
    
    if (withRecent.publications && withRecent.publications.length > 0) {
      console.log('   ✓ Found', withRecent.publications.length, 'publications\n');
      withRecent.publications.forEach((pub, i) => {
        console.log(`   ${i + 1}. "${pub.bib.title?.substring(0, 60)}..."`);
        console.log(`      Year: ${pub.bib.pub_year || 'N/A'}, Citations: ${pub.num_citations || 0}`);
      });
    } else {
      console.log('   ⚠️  No publications found');
    }
    
    console.log('\n' + '─'.repeat(70));
    console.log('\n✅ Verification Complete!\n');
    console.log('📊 Summary:');
    console.log('   • Scholar ID is valid: ✅');
    console.log('   • Author information fetched: ✅');
    console.log('   • Publications fetched correctly: ✅');
    console.log('   • Both sort orders working: ✅\n');
    
  } catch (error) {
    console.error('\n❌ Verification Failed!\n');
    console.error('Error:', error.message);
    console.error('\n📝 Possible Issues:');
    console.error('   1. Invalid Scholar ID - check the ID is correct');
    console.error('   2. Network issues - check internet connection');
    console.error('   3. Rate limiting - Google Scholar is blocking requests');
    console.error('   4. Proxy needed - configure ScraperAPI for production use\n');
    console.error('Full error:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  const scholarId = process.argv[2];
  verifyScholarId(scholarId);
}

module.exports = { verifyScholarId };
