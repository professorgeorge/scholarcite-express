/**
 * ScholarCite Express - Google Scholar DOM Parser & Classifier
 * Extracts structured paper metadata and classifies publication types (Journal, Book, Conference, Preprint).
 */

window.ScholarDOMParser = {
  parsePageResults: function() {
    const results = [];
    const seenKeys = new Set();

    // Select primary result container elements cleanly (exclude right-side download widgets)
    const resultElements = Array.from(document.querySelectorAll('.gs_r.gs_or.gs_scl, .gs_r:not(.gs_ggs):not(.gs_msg_d):not(.gs_scl_b)'))
      .filter(el => !el.classList.contains('gs_ggs') && el.querySelector('.gs_rt'));

    resultElements.forEach((el) => {
      const paper = this.parseSingleResult(el, results.length + 1);
      if (paper && paper.title) {
        const uniqueKey = (paper.cid || paper.title).toLowerCase().trim();
        if (!seenKeys.has(uniqueKey)) {
          seenKeys.add(uniqueKey);
          results.push(paper);
        }
      }
    });

    return results;
  },

  parseSingleResult: function(el, index) {
    const titleEl = el.querySelector('.gs_rt');
    const linkEl = titleEl ? titleEl.querySelector('a') : null;
    let rawTitle = linkEl ? linkEl.innerText : (titleEl ? titleEl.innerText : '');
    
    // Extract title badges like [PDF], [HTML], [BOOK], [CITATION], [B], [C]
    const badgeMatch = (titleEl ? titleEl.innerText : '').match(/^\[([A-Z0-9\s]+)\]/i);
    const rawBadge = badgeMatch ? badgeMatch[1].toUpperCase() : '';

    // Clean all leading brackets like [CITATION], [BOOK], [B], [PDF], etc.
    let title = rawTitle
      .replace(/^(\[[^\]]+\]\s*)+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const url = linkEl ? linkEl.href : '';

    const metaEl = el.querySelector('.gs_a');
    const metaText = metaEl ? metaEl.innerText.trim() : '';

    const parsedMeta = this.parseMetaString(metaText);

    const snippetEl = el.querySelector('.gs_rs');
    const snippet = snippetEl ? snippetEl.innerText.replace(/\s+/g, ' ').trim() : '';

    const citBtn = el.querySelector('.gs_or_cit, [data-cid]');
    const cid = citBtn ? (citBtn.getAttribute('data-cid') || '') : (el.getAttribute('data-cid') || '');

    // Extract Citation Count - Search all footer elements excluding right-side OA widgets
    let citeCount = 0;
    const footers = Array.from(el.querySelectorAll('.gs_fl'));
    for (const f of footers) {
      if (f.closest('.gs_ggs')) continue;
      const citeMatch = f.innerText.match(/Cited by\s+([\d,]+)/i);
      if (citeMatch) {
        citeCount = parseInt(citeMatch[1].replace(/,/g, ''), 10) || 0;
        break;
      }
    }

    // Classify Publication Type
    const type = this.classifyPublicationType(rawBadge, title, parsedMeta.venue, parsedMeta.publisher, url);

    return {
      index: index,
      cid: cid,
      title: title,
      url: url,
      authors: parsedMeta.authors,
      authorString: parsedMeta.authorString,
      venue: parsedMeta.venue,
      year: parsedMeta.year,
      publisher: parsedMeta.publisher,
      rawMeta: metaText,
      snippet: snippet,
      citeCount: citeCount,
      type: type,
      rawBadge: rawBadge,
      element: el
    };
  },

  parseMetaString: function(metaText) {
    if (!metaText) {
      return { authors: [], authorString: 'Unknown Author', venue: '', year: '', publisher: '' };
    }

    // Normalize non-breaking spaces and split by dashes / en-dashes
    const normalized = metaText.replace(/\u00A0/g, ' ').trim();
    const parts = normalized.split(/\s+[\-\u2013\u2014]\s+/);

    let year = '';
    const yearMatch = normalized.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      year = yearMatch[1];
    }

    let rawAuthors = '';
    let rawVenueYear = '';
    let rawPublisher = '';

    if (parts.length >= 3) {
      rawAuthors = parts[0] || '';
      rawVenueYear = parts[1] || '';
      rawPublisher = parts.slice(2).join(' - ');
    } else if (parts.length === 2) {
      // Check if part 0 contains the year (no author listed, e.g. "Nature, 2021 - nature.com")
      if (year && parts[0].includes(year) && !parts[1].includes(year)) {
        rawAuthors = '';
        rawVenueYear = parts[0];
        rawPublisher = parts[1];
      } else {
        rawAuthors = parts[0] || '';
        rawVenueYear = parts[1] || '';
        rawPublisher = '';
      }
    } else {
      if (year && parts[0].includes(year)) {
        rawVenueYear = parts[0];
      } else {
        rawAuthors = parts[0] || '';
      }
    }

    let authors = [];
    if (rawAuthors) {
      let cleanedAuthors = rawAuthors.replace(/\s*(\.\.\.|…)\s*$/, '').trim();
      authors = cleanedAuthors.split(/,\s*/).map(a => a.trim()).filter(a => a.length > 0 && !/^\d+$/.test(a));
    }

    let venue = rawVenueYear;
    if (year && venue.includes(year)) {
      venue = venue.replace(new RegExp(`,?\\s*${year}`), '').trim();
    }
    venue = venue.replace(/^,\s*|,\s*$/g, '').trim();

    return {
      authors: authors,
      authorString: authors.length > 0 ? authors.join(', ') : 'Unknown Author',
      venue: venue,
      year: year || 'n.d.',
      publisher: rawPublisher.trim()
    };
  },

  /**
   * Classify publication type into: 'journal' | 'book' | 'conference' | 'preprint' | 'other'
   */
  classifyPublicationType: function(badge, title, venue, publisher, url) {
    const combinedStr = `${title} ${venue} ${publisher} ${url}`.toLowerCase();

    if (badge === 'BOOK' || combinedStr.includes('book') || combinedStr.includes('chapter') || combinedStr.includes('routledge') || combinedStr.includes('springer nature')) {
      return 'book';
    }

    if (combinedStr.includes('arxiv') || combinedStr.includes('ssrn') || combinedStr.includes('biorxiv') || combinedStr.includes('medrxiv') || combinedStr.includes('chemrxiv') || combinedStr.includes('research square') || combinedStr.includes('preprints.org') || combinedStr.includes('authorea') || combinedStr.includes('eduzhai') || combinedStr.includes('preprint') || combinedStr.includes('working paper') || combinedStr.includes('discussion paper') || combinedStr.includes('nber')) {
      return 'preprint';
    }

    if (combinedStr.includes('conference') || combinedStr.includes('proceedings') || combinedStr.includes('symposium') || combinedStr.includes('workshop') || combinedStr.includes('ieee int') || combinedStr.includes('acm')) {
      return 'conference';
    }

    if (combinedStr.includes('journal') || combinedStr.includes('review') || combinedStr.includes('letters') || combinedStr.includes('transactions') || combinedStr.includes('bulletin') || combinedStr.includes('nature') || combinedStr.includes('science') || combinedStr.includes('plos') || combinedStr.includes('elsevier') || combinedStr.includes('sage')) {
      return 'journal';
    }

    return 'journal'; // Default to journal for standard articles
  }
};
