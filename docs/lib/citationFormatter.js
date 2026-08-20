/**
 * ScholarCite Express - Citation Formatting Engine
 * Formats basic or enriched metadata (with Volume, Issue, Pages, DOI) into standard styles.
 */

window.ScholarCitationFormatter = {
  /**
   * Format paper metadata into chosen style.
   * @param {Object} paper 
   * @param {string} style - 'apa' | 'mla' | 'chicago' | 'ieee' | 'harvard' | 'bibtex'
   * @returns {string} Formatted citation string
   */
  format: function(paper, style) {
    if (!paper) return '';
    style = (style || 'apa').toLowerCase();

    // If official citation string from Scholar exists and matches style, prefer it!
    if (paper.officialCitations && paper.officialCitations[style]) {
      return paper.officialCitations[style];
    }

    switch (style) {
      case 'apa':
        return this.formatAPA(paper);
      case 'mla':
        return this.formatMLA(paper);
      case 'chicago':
        return this.formatChicago(paper);
      case 'ieee':
        return this.formatIEEE(paper);
      case 'harvard':
        return this.formatHarvard(paper);
      case 'bibtex':
        return this.formatBibTeX(paper);
      default:
        return this.formatAPA(paper);
    }
  },

  /**
   * Helper to format author names into "Last, F. M." format
   */
  parseAuthorName: function(nameStr) {
    if (!nameStr) return { last: 'Unknown', initials: '' };
    nameStr = nameStr.trim();
    if (!nameStr) return { last: 'Unknown', initials: '' };

    if (nameStr.includes(',')) {
      const sub = nameStr.split(',');
      const last = sub[0].trim();
      const firstParts = sub[1].trim().split(/\s+/).filter(p => p.length > 0);
      const initials = firstParts.map(p => (p[0] ? p[0].toUpperCase() + '.' : '')).filter(p => p.length > 0).join(' ');
      return { last, initials, original: nameStr };
    }

    const parts = nameStr.split(/\s+/).filter(p => p.length > 0);
    if (parts.length === 1) {
      return { last: parts[0], initials: '' };
    }

    const last = parts.pop();
    const initials = parts.map(p => (p[0] ? p[0].toUpperCase() + '.' : '')).filter(p => p.length > 0).join(' ');
    return { last, initials, original: nameStr };
  },

  formatTitleWithPeriod: function(title) {
    if (!title) return '';
    let t = title.trim();
    return /[.?!]$/.test(t) ? t : `${t}.`;
  },

  /**
   * APA 7th Edition:
   * Author, A. A. (Year). Title of article. Journal Name, Volume(Issue), Pages. https://doi.org/...
   */
  formatAPA: function(paper) {
    const authors = (paper.fullAuthors && paper.fullAuthors.length > 0) ? paper.fullAuthors : (paper.authors || []);
    let authorStr = '';

    if (authors.length === 0) {
      authorStr = 'Anonymous';
    } else if (authors.length === 1) {
      const a = this.parseAuthorName(authors[0]);
      authorStr = `${a.last}${a.initials ? ', ' + a.initials : ''}`;
    } else if (authors.length === 2) {
      const a1 = this.parseAuthorName(authors[0]);
      const a2 = this.parseAuthorName(authors[1]);
      authorStr = `${a1.last}${a1.initials ? ', ' + a1.initials : ''}, & ${a2.last}${a2.initials ? ', ' + a2.initials : ''}`;
    } else if (authors.length <= 20) {
      const formatted = authors.map(aName => {
        const a = this.parseAuthorName(aName);
        return `${a.last}${a.initials ? ', ' + a.initials : ''}`;
      });
      const lastAuthor = formatted.pop();
      authorStr = `${formatted.join(', ')}, & ${lastAuthor}`;
    } else {
      const formatted = authors.slice(0, 19).map(aName => {
        const a = this.parseAuthorName(aName);
        return `${a.last}${a.initials ? ', ' + a.initials : ''}`;
      });
      const lastAuthor = this.parseAuthorName(authors[authors.length - 1]);
      authorStr = `${formatted.join(', ')}, ... ${lastAuthor.last}${lastAuthor.initials ? ', ' + lastAuthor.initials : ''}`;
    }

    const yearStr = paper.year ? `(${paper.year})` : '(n.d.)';
    let titleStr = this.formatTitleWithPeriod(paper.title);
    let venue = paper.fullVenue || paper.venue;
    let venueStr = venue ? `*${venue}*` : '';

    // Enriched Vol / Issue / Pages
    let volIssuePages = '';
    if (paper.volume) {
      volIssuePages += `, *${paper.volume}*`;
      if (paper.issue) {
        volIssuePages += `(${paper.issue})`;
      }
    }
    if (paper.pages) {
      volIssuePages += `, ${paper.pages}`;
    }

    let doiStr = paper.doi ? ` https://doi.org/${paper.doi}` : (paper.url ? ` ${paper.url}` : '');

    return `${authorStr} ${yearStr}. ${titleStr} ${venueStr}${volIssuePages}.${doiStr}`.replace(/\s+/g, ' ').trim();
  },

  /**
   * MLA 9th Edition:
   * Author, First. "Title." Journal Name, vol. X, no. Y, Year, pp. Z-Z.
   */
  formatMLA: function(paper) {
    const authors = (paper.fullAuthors && paper.fullAuthors.length > 0) ? paper.fullAuthors : (paper.authors || []);
    let authorStr = '';

    if (authors.length === 1) {
      const a = this.parseAuthorName(authors[0]);
      authorStr = `${a.last}, ${a.initials || 'A.'}.`;
    } else if (authors.length === 2) {
      const a1 = this.parseAuthorName(authors[0]);
      const a2 = this.parseAuthorName(authors[1]);
      authorStr = `${a1.last}, ${a1.initials || 'A.'}, and ${a2.initials ? a2.initials + ' ' : ''}${a2.last}.`;
    } else if (authors.length > 2) {
      const a1 = this.parseAuthorName(authors[0]);
      authorStr = `${a1.last}, ${a1.initials || 'A.'}, et al.`;
    } else {
      authorStr = 'Anonymous.';
    }

    const cleanTitle = paper.title.replace(/"/g, "'").trim();
    const titlePunct = /[.?!]$/.test(cleanTitle) ? '' : '.';
    let titleStr = `"${cleanTitle}${titlePunct}"`;
    let venue = paper.fullVenue || paper.venue;
    let venueStr = venue ? ` *${venue}*` : '';

    let volStr = paper.volume ? `, vol. ${paper.volume}` : '';
    let issueStr = paper.issue ? `, no. ${paper.issue}` : '';
    let yearStr = paper.year ? `, ${paper.year}` : '';
    let pageStr = paper.pages ? `, pp. ${paper.pages}` : '';
    let doiStr = paper.doi ? `. https://doi.org/${paper.doi}` : (paper.url ? `. ${paper.url}` : '.');

    return `${authorStr} ${titleStr}${venueStr}${volStr}${issueStr}${yearStr}${pageStr}${doiStr}`.replace(/\s+/g, ' ').trim();
  },

  /**
   * Chicago 17th Edition:
   * Author, First. "Title." Journal Name volume, no. issue (Year): pages.
   */
  formatChicago: function(paper) {
    const authors = (paper.fullAuthors && paper.fullAuthors.length > 0) ? paper.fullAuthors : (paper.authors || []);
    let authorStr = '';

    if (authors.length === 1) {
      const a = this.parseAuthorName(authors[0]);
      authorStr = `${a.last}, ${a.initials || 'A.'}.`;
    } else if (authors.length >= 2) {
      const a1 = this.parseAuthorName(authors[0]);
      const formattedRest = authors.slice(1).map(name => {
        const a = this.parseAuthorName(name);
        return `${a.initials ? a.initials + ' ' : ''}${a.last}`;
      });
      authorStr = `${a1.last}, ${a1.initials || 'A.'}, and ${formattedRest.join(', ')}.`;
    } else {
      authorStr = 'Anonymous.';
    }

    const cleanTitle = paper.title.replace(/"/g, "'").trim();
    const titlePunct = /[.?!]$/.test(cleanTitle) ? '' : '.';
    let titleStr = `"${cleanTitle}${titlePunct}"`;
    let venue = paper.fullVenue || paper.venue;
    let venueStr = venue ? ` *${venue}*` : '';

    let volStr = paper.volume ? ` ${paper.volume}` : '';
    let issueStr = paper.issue ? `, no. ${paper.issue}` : '';
    let yearStr = paper.year ? ` (${paper.year})` : '';
    let pageStr = paper.pages ? `: ${paper.pages}` : '';
    let doiStr = paper.doi ? `. https://doi.org/${paper.doi}` : (paper.url ? `. ${paper.url}` : '.');

    return `${authorStr} ${titleStr}${venueStr}${volStr}${issueStr}${yearStr}${pageStr}${doiStr}`.replace(/\s+/g, ' ').trim();
  },

  /**
   * IEEE Style:
   * [N] A. A. Author, "Title," Journal Name, vol. X, no. Y, pp. Z-Z, Year.
   */
  formatIEEE: function(paper) {
    const authors = (paper.fullAuthors && paper.fullAuthors.length > 0) ? paper.fullAuthors : (paper.authors || []);
    let authorStr = '';

    if (authors.length > 0) {
      const formatted = authors.map(name => {
        const a = this.parseAuthorName(name);
        return `${a.initials ? a.initials + ' ' : ''}${a.last}`;
      });

      if (formatted.length === 1) {
        authorStr = formatted[0];
      } else if (formatted.length === 2) {
        authorStr = `${formatted[0]} and ${formatted[1]}`;
      } else if (formatted.length > 6) {
        authorStr = `${formatted[0]} *et al.*`;
      } else {
        const last = formatted.pop();
        authorStr = `${formatted.join(', ')}, and ${last}`;
      }
    } else {
      authorStr = 'Anon.';
    }

    const idxStr = paper.index ? `[${paper.index}] ` : '';
    const cleanTitle = paper.title.trim();
    const titlePunct = /[,.?!]$/.test(cleanTitle) ? '' : ',';
    let titleStr = `"${cleanTitle}${titlePunct}"`;
    let venue = paper.fullVenue || paper.venue;
    let venueStr = venue ? ` *${venue}*,` : '';
    let volStr = paper.volume ? ` vol. ${paper.volume},` : '';
    let issueStr = paper.issue ? ` no. ${paper.issue},` : '';
    let pageStr = paper.pages ? ` pp. ${paper.pages},` : '';
    let yearStr = paper.year ? ` ${paper.year}.` : '.';

    return `${idxStr}${authorStr}, ${titleStr}${venueStr}${volStr}${issueStr}${pageStr}${yearStr}`.replace(/\s+/g, ' ').trim();
  },

  /**
   * Harvard Style:
   * Author, A.A., Year. Title. Journal Name, Volume(Issue), pp. Z-Z.
   */
  formatHarvard: function(paper) {
    const authors = (paper.fullAuthors && paper.fullAuthors.length > 0) ? paper.fullAuthors : (paper.authors || []);
    let authorStr = '';

    if (authors.length > 0) {
      const formatted = authors.map(name => {
        const a = this.parseAuthorName(name);
        return `${a.last}, ${a.initials ? a.initials.replace(/\s+/g, '') : ''}`;
      });

      if (formatted.length === 1) {
        authorStr = formatted[0];
      } else if (formatted.length === 2) {
        authorStr = `${formatted[0]} and ${formatted[1]}`;
      } else {
        authorStr = `${formatted[0]} et al.`;
      }
    } else {
      authorStr = 'Anon.';
    }

    const yearStr = paper.year ? `${paper.year}.` : 'n.d.';
    let titleStr = this.formatTitleWithPeriod(paper.title);
    let venue = paper.fullVenue || paper.venue;
    let venueStr = venue ? ` *${venue}*` : '';

    let volStr = paper.volume ? `, ${paper.volume}` : '';
    let issueStr = paper.issue ? `(${paper.issue})` : '';
    let pageStr = paper.pages ? `, pp. ${paper.pages}` : '';

    return `${authorStr} ${yearStr} ${titleStr}${venueStr}${volStr}${issueStr}${pageStr}.`.replace(/\s+/g, ' ').trim();
  },

  /**
   * BibTeX Format:
   * Includes volume, number, pages, and doi fields
   */
  formatBibTeX: function(paper) {
    const firstAuthor = paper.authors && paper.authors.length > 0 
      ? this.parseAuthorName(paper.authors[0]).last.toLowerCase().replace(/[^a-z0-9]/g, '')
      : 'article';
    const year = paper.year || 'year';
    const firstTitleWord = (paper.title || 'title').split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const citeKey = `${firstAuthor}${year}${firstTitleWord}`;

    const authors = (paper.fullAuthors && paper.fullAuthors.length > 0) ? paper.fullAuthors : (paper.authors || []);
    const authorField = authors.join(' and ');
    
    let bib = `@article{${citeKey},\n` +
              `  title={${paper.title}},\n` +
              `  author={${authorField}},\n` +
              `  journal={${paper.fullVenue || paper.venue || 'Google Scholar Search'}},\n` +
              `  year={${paper.year || ''}}`;
    
    if (paper.volume) bib += `,\n  volume={${paper.volume}}`;
    if (paper.issue) bib += `,\n  number={${paper.issue}}`;
    if (paper.pages) bib += `,\n  pages={${paper.pages}}`;
    if (paper.doi) bib += `,\n  doi={${paper.doi}}`;
    if (paper.url) bib += `,\n  url={${paper.url}}`;

    bib += `\n}`;
    return bib;
  }
};
