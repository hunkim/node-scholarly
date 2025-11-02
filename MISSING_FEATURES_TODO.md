# Missing Features TODO

## 🔴 HIGH PRIORITY

### 1. Per-Publication Public Access Marking
**File**: `src/authorParser.ts` → `fillPublicAccess()` method

**Current State**: Only gets summary counts
```typescript
author.public_access = {
  available: nAvailable,
  not_available: nNotAvailable,
};
```

**Required**: Mark each publication with public access status
```typescript
// Add after getting summary counts:
if (!author.filled.includes('publications')) {
  return; // Can't mark publications if they haven't been filled yet
}

// Create publication lookup map
const publicationsMap: { [key: string]: Publication } = {};
author.publications?.forEach(pub => {
  if (pub.author_pub_id) {
    publicationsMap[pub.author_pub_id] = pub;
  }
});

// Fetch mandate pages
const mandatesUrl = MANDATES.replace('{0}', author.scholar_id).replace('{1}', String(PAGESIZE));
let $mandates = await this.nav.getSoup(mandatesUrl);

while (true) {
  // Mark not available publications
  const notAvailRows = $mandates('.gsc_mnd_sec_na').first();
  if (notAvailRows.length) {
    notAvailRows.find('a.gsc_mnd_art_rvw.gs_nph.gsc_mnd_link_font').each((i: number, row: any) => {
      const href = $mandates(row).attr('data-href');
      if (href) {
        const match = href.match(/citation_for_view=([\w:-]*)/);
        if (match && publicationsMap[match[1]]) {
          publicationsMap[match[1]].public_access = false;
        }
      }
    });
  }

  // Mark available publications
  const availRows = $mandates('.gsc_mnd_sec_avl').first();
  if (availRows.length) {
    availRows.find('a.gsc_mnd_art_rvw.gs_nph.gsc_mnd_link_font').each((i: number, row: any) => {
      const href = $mandates(row).attr('data-href');
      if (href) {
        const match = href.match(/citation_for_view=([\w:-]*)/);
        if (match && publicationsMap[match[1]]) {
          publicationsMap[match[1]].public_access = true;
        }
      }
    });
  }

  // Check for next page
  const nextButton = $mandates('.gs_btnPR');
  if (nextButton.length && !nextButton.attr('disabled')) {
    const onclick = nextButton.attr('onclick');
    if (onclick) {
      // Extract URL from onclick="GS_selectMndt('...')"
      const urlMatch = onclick.match(/GS_selectMndt\('(.*)'\)/);
      if (urlMatch) {
        let url = urlMatch[1];
        // Decode unicode escapes
        url = url.replace(/\\x([0-9A-Fa-f]{2})/g, (match, hex) => 
          String.fromCharCode(parseInt(hex, 16))
        );
        $mandates = await this.nav.getSoup(url);
      } else {
        break;
      }
    } else {
      break;
    }
  } else {
    break;
  }
}
```

---

### 2. Publication Mandate Details
**File**: `src/publicationParser.ts` → Add new method

**Required**: Implement `fillPublicAccessMandates()` method
```typescript
private async fillPublicAccessMandates(publication: Publication): Promise<void> {
  if (!publication.public_access || !publication.author_pub_id) {
    return;
  }

  const mandatesUrl = `/citations?view_op=view_mandate&hl=en&citation_for_view=${publication.author_pub_id}`;
  const $ = await this.nav.getSoup(mandatesUrl);

  publication.mandates = [];

  const mandateItems = $('li').toArray();
  for (const item of mandateItems) {
    const $item = $(item);
    const mandate: any = {};

    // Agency name
    const agencyElem = $item.find('span.gsc_md_mndt_name');
    if (agencyElem.length) {
      mandate.agency = agencyElem.text().trim();
    }

    // Policy URL
    const policyLink = $item.find('div.gsc_md_mndt_title a');
    if (policyLink.length) {
      mandate.url_policy = policyLink.attr('href');
    }

    // Cached policy URL
    const cachedLink = $item.find('span.gs_a a');
    if (cachedLink.length) {
      mandate.url_policy_cached = cachedLink.attr('href');
    }

    // Parse descriptions
    const descriptions = $item.find('div.gsc_md_mndt_desc').toArray();
    for (const desc of descriptions) {
      const $desc = $(desc);
      const text = $desc.text();

      // Effective date
      const dateMatch = text.match(/Effective date: (\d{4})\/(\d{1,2})/);
      if (dateMatch) {
        mandate.effective_date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}`;
      }

      // Embargo period
      const embargoMatch = text.match(/Embargo period: (\d{1,2}) months/);
      if (embargoMatch) {
        mandate.embargo = `${embargoMatch[1]} months`;
      }

      // Funding acknowledgment
      if (text.includes('Funding acknowledgment')) {
        const ackElem = $desc.find('span.gs_gray');
        if (ackElem.length) {
          mandate.acknowledgement = ackElem.text().trim();
        }
      }
    }

    publication.mandates.push(mandate);
  }
}
```

**Also update**: `PublicationParser.fill()` method (line ~363 in Python):
```typescript
async fill(publication: Publication): Promise<Publication> {
  // ... existing code ...

  if (publication.public_access) {
    publication.mandates = [];
    await this.fillPublicAccessMandates(publication);
  }

  publication.filled = true;
  // ...
}
```

---

## 🟡 MEDIUM PRIORITY

### 3. Extended Coauthors List (>20)
**File**: `src/authorParser.ts` → `fillCoauthors()` method

**Required**: Detect "View All" button and fetch complete list

```typescript
private async fillCoauthors($: cheerio.CheerioAPI, author: Author): Promise<void> {
  author.coauthors = [];

  // Check if "View All" button exists
  const viewAllButton = $('#gsc_coauth_opn');
  
  let coauthorInfo: { ids: string[], names: string[], affiliations: string[] };

  if (viewAllButton.length === 0) {
    // Short list (≤20 coauthors)
    coauthorInfo = this.getCoauthorsShort($);
  } else {
    // Long list (>20 coauthors)
    try {
      coauthorInfo = await this.getCoauthorsLong(author);
    } catch (error) {
      console.warn('Failed to fetch long coauthor list, falling back to short list:', error);
      coauthorInfo = this.getCoauthorsShort($);
    }
  }

  // Build coauthor list
  for (let i = 0; i < coauthorInfo.ids.length; i++) {
    const newCoauthor = this.getAuthor(coauthorInfo.ids[i]);
    newCoauthor.name = coauthorInfo.names[i];
    newCoauthor.affiliation = coauthorInfo.affiliations[i];
    newCoauthor.source = AuthorSource.CO_AUTHORS_LIST;
    author.coauthors.push(newCoauthor);
  }
}

private getCoauthorsShort($: cheerio.CheerioAPI): { ids: string[], names: string[], affiliations: string[] } {
  const coauthors = $('.gsc_rsb_a_desc').toArray();
  const ids: string[] = [];
  const names: string[] = [];
  const affiliations: string[] = [];

  for (const coauth of coauthors) {
    const $coauth = $(coauth);
    const link = $coauth.find('a').first();
    const href = link.attr('href');

    if (href) {
      const match = href.match(CITATIONAUTHRE);
      if (match) {
        ids.push(match[1]);
        names.push(link.text().trim());
        affiliations.push($coauth.find('.gsc_rsb_a_ext').text().trim());
      }
    }
  }

  return { ids, names, affiliations };
}

private async getCoauthorsLong(author: Author): Promise<{ ids: string[], names: string[], affiliations: string[] }> {
  const url = COAUTH.replace('{0}', author.scholar_id);
  const $ = await this.nav.getSoup(url);

  const coauthors = $('.gs_ai.gs_scl').toArray();
  const ids: string[] = [];
  const names: string[] = [];
  const affiliations: string[] = [];

  for (const coauth of coauthors) {
    const $coauth = $(coauth);
    const link = $coauth.find('a').first();
    const href = link.attr('href');

    if (href) {
      const match = href.match(CITATIONAUTHRE);
      if (match) {
        ids.push(match[1]);
        names.push($coauth.find('.gs_ai_name').text().trim());
        affiliations.push($coauth.find('.gs_ai_aff').text().trim());
      }
    }
  }

  return { ids, names, affiliations };
}
```

---

## 🟢 LOW PRIORITY

### 4. BibTeX Parsing Library
**Consider**: Using a BibTeX parsing library for TypeScript

**Options**:
- `bibtex-js`: Popular BibTeX parser
- `@retorquere/bibtex-parser`: Modern, maintained
- `astrocite-bibtex`: Academic citation focused

**Benefits**:
- More robust parsing
- Better edge case handling
- Type safety

**Current Status**: Manual parsing works for most cases, not urgent

---

## 📝 Testing Requirements

For each implemented feature, add tests to `src/__tests__/scholarly.test.ts`:

1. **Public Access per Publication**:
```typescript
test('fillPublicAccess should mark individual publications', async () => {
  const author = await scholarly.searchAuthorId('JE_m2UgAAAAJ', false);
  const filled = await scholarly.fill(author, ['publications', 'public_access']);
  
  expect(filled.public_access).toBeDefined();
  expect(filled.public_access.available).toBeGreaterThan(0);
  
  // Check if any publication has public_access field
  const pubsWithAccess = filled.publications?.filter(p => p.public_access !== undefined);
  expect(pubsWithAccess).toBeDefined();
  expect(pubsWithAccess!.length).toBeGreaterThan(0);
});
```

2. **Publication Mandates**:
```typescript
test('fill should populate publication mandates', async () => {
  // Find an author with public access mandates
  const pub = /* ... get publication with public_access = true ... */;
  const filled = await scholarly.fill(pub);
  
  if (filled.public_access) {
    expect(filled.mandates).toBeDefined();
    expect(filled.mandates!.length).toBeGreaterThan(0);
    
    const mandate = filled.mandates![0];
    expect(mandate.agency).toBeDefined();
    expect(mandate.url_policy).toBeDefined();
  }
});
```

3. **Extended Coauthors**:
```typescript
test('fillCoauthors should fetch all coauthors (>20)', async () => {
  // Find an author with >20 coauthors
  const author = await scholarly.searchAuthorId('AUTHOR_WITH_MANY_COAUTHORS');
  const filled = await scholarly.fill(author, ['coauthors']);
  
  expect(filled.coauthors).toBeDefined();
  expect(filled.coauthors!.length).toBeGreaterThan(20);
});
```

---

## 🎯 Implementation Priority

**Week 1**: High Priority #1 (Per-publication public access)
**Week 2**: High Priority #2 (Publication mandates)
**Week 3**: Medium Priority #3 (Extended coauthors)
**Later**: Low Priority #4 (BibTeX library - optional)

---

*Last updated: 2025-11-02*

