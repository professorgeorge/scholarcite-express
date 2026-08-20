/**
 * ScholarCite Express - COinS OpenURL v1.0 Generator
 * Encodes paper metadata into OpenURL Z39.88-2004 format for <span class="Z3988"> tags.
 * Allows reference managers (Zotero, Mendeley, EndNote, RefWorks) to instantly auto-detect citations.
 */

window.ScholarCOinSGenerator = {
  /**
   * Generate OpenURL Z39.88-2004 title attribute string
   * @param {Object} paper - Paper metadata object
   * @returns {string} Encoded OpenURL string
   */
  generateCOinS: function(paper) {
    if (!paper || !paper.title) return '';

    const params = [];
    params.push('url_ver=Z39.88-2004');
    params.push('ctx_ver=Z39.88-2004');

    const type = (paper.type || 'journal').toLowerCase();

    if (type === 'book') {
      params.push('rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Abook');
      params.push('rft.genre=book');
      params.push(`rft.btitle=${encodeURIComponent(paper.title)}`);
      if (paper.publisher) params.push(`rft.pub=${encodeURIComponent(paper.publisher)}`);
    } else {
      params.push('rft_val_fmt=info%3Aofi%2Ffmt%3Akev%3Amtx%3Ajournal');
      params.push('rft.genre=article');
      params.push(`rft.atitle=${encodeURIComponent(paper.title)}`);
      const venue = paper.fullVenue || paper.venue;
      if (venue) params.push(`rft.jtitle=${encodeURIComponent(venue)}`);
    }

    if (paper.year && paper.year !== 'n.d.') {
      params.push(`rft.date=${encodeURIComponent(paper.year)}`);
    }

    if (paper.volume) {
      params.push(`rft.volume=${encodeURIComponent(paper.volume)}`);
    }

    if (paper.issue) {
      params.push(`rft.issue=${encodeURIComponent(paper.issue)}`);
    }

    if (paper.pages) {
      const pageParts = paper.pages.split(/[-–—]/);
      if (pageParts[0]) params.push(`rft.spage=${encodeURIComponent(pageParts[0].trim())}`);
      if (pageParts[1]) params.push(`rft.epage=${encodeURIComponent(pageParts[1].trim())}`);
    }

    if (paper.doi) {
      const cleanDoi = paper.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
      params.push(`rft.id=info%3Adoi%2F${encodeURIComponent(cleanDoi)}`);
    }

    if (paper.url) {
      params.push(`rft_id=${encodeURIComponent(paper.url)}`);
    }

    // Add Authors
    const authors = (paper.fullAuthors && paper.fullAuthors.length > 0) ? paper.fullAuthors : (paper.authors || []);
    authors.forEach(author => {
      if (author && author.length > 0) {
        params.push(`rft.au=${encodeURIComponent(author.trim())}`);
      }
    });

    return params.join('&');
  }
};
