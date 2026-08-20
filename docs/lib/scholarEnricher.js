/**
 * ScholarCite Express - Full Metadata Enrichment Engine
 * Fetches complete Volume, Issue, Page numbers, DOIs, and full author names
 * exclusively from Open Public APIs (Crossref & OpenAlex) with caching, rate protection,
 * and background service worker proxying.
 *
 * GUARANTEE: Touches ZERO Google Scholar endpoints to completely eliminate robot/CAPTCHA risks.
 */

window.ScholarEnricher = {
  // In-memory cache for fast lookups during the session
  cache: {},

  callApi: async function(url, options = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      return new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage({ action: 'FETCH_API', url: url, options: options }, response => {
            if (chrome.runtime.lastError) {
              this.directFetch(url, options).then(resolve).catch(reject);
              return;
            }
            if (response && response.success) {
              resolve(response.data);
            } else {
              reject(new Error(response ? response.error : 'Background fetch failed'));
            }
          });
        } catch (err) {
          this.directFetch(url, options).then(resolve).catch(reject);
        }
      });
    }
    return this.directFetch(url, options);
  },

  directFetch: async function(url, options = {}) {
    const res = await fetch(url, options);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { return text; }
  },

  /**
   * Main entry point to enrich a single paper object with complete volume, issue, pages, DOI, etc.
   * Touches 0 Google Scholar endpoints!
   * @param {Object} paper 
   * @returns {Promise<Object>} Enriched paper metadata object
   */
  enrichPaper: async function(paper) {
    if (!paper) return paper;
    const cacheKey = paper.cid || paper.doi || paper.title;

    // 1. Check in-memory cache
    if (this.cache[cacheKey]) {
      return Object.assign(paper, this.cache[cacheKey], { isEnriched: true });
    }

    // 2. Check chrome local storage cache
    const stored = await this.getStorageCache(cacheKey);
    if (stored) {
      this.cache[cacheKey] = stored;
      return Object.assign(paper, stored, { isEnriched: true });
    }

    let enrichedData = {
      volume: '',
      issue: '',
      pages: '',
      doi: '',
      fullAuthors: [],
      fullVenue: ''
    };

    // Strategy 1: Crossref Open API Lookup (Primary for exact Volume, Issue, Pages & DOI)
    try {
      const crossrefData = await this.fetchCrossrefMetadata(paper.title);
      if (crossrefData) {
        if (crossrefData.volume) enrichedData.volume = crossrefData.volume;
        if (crossrefData.issue) enrichedData.issue = crossrefData.issue;
        if (crossrefData.pages) enrichedData.pages = crossrefData.pages;
        if (crossrefData.doi) enrichedData.doi = crossrefData.doi;
        if (crossrefData.fullVenue) enrichedData.fullVenue = crossrefData.fullVenue;
        if (crossrefData.fullAuthors && crossrefData.fullAuthors.length > 0) {
          enrichedData.fullAuthors = crossrefData.fullAuthors;
        }
      }
    } catch (err) {
      // Fall through quietly
    }

    // Strategy 2: OpenAlex Open API (Fallback if volume/issue/pages/doi still missing)
    if (!enrichedData.pages || !enrichedData.volume || !enrichedData.doi) {
      try {
        const alexData = await this.fetchOpenAlexMetadata(paper.title);
        if (alexData) {
          if (!enrichedData.volume && alexData.volume) enrichedData.volume = alexData.volume;
          if (!enrichedData.issue && alexData.issue) enrichedData.issue = alexData.issue;
          if (!enrichedData.pages && alexData.pages) enrichedData.pages = alexData.pages;
          if (!enrichedData.doi && alexData.doi) enrichedData.doi = alexData.doi;
          if (!enrichedData.fullVenue && alexData.fullVenue) enrichedData.fullVenue = alexData.fullVenue;
          if ((!enrichedData.fullAuthors || enrichedData.fullAuthors.length === 0) && alexData.fullAuthors) {
            enrichedData.fullAuthors = alexData.fullAuthors;
          }
        }
      } catch (err) {
        // Fall through quietly
      }
    }

    enrichedData.isEnriched = true;

    // Save to cache
    this.cache[cacheKey] = enrichedData;
    this.setStorageCache(cacheKey, enrichedData);

    return Object.assign(paper, enrichedData);
  },

  /**
   * Fetch Crossref Free Public Metadata API via Background Service Worker
   */
  fetchCrossrefMetadata: async function(title) {
    if (!title || title.length < 5) return null;
    
    const cleanTitle = title
      .replace(/^(\[[^\]]+\]\s*)+/gi, '')
      .replace(/\.\.\.\s*$/, '')
      .replace(/…\s*$/, '')
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}&rows=3`;
    
    const data = await this.callApi(url);
    const items = data.message ? data.message.items : [];
    if (!items || items.length === 0) return null;

    for (const item of items) {
      const matchedTitle = (item.title && item.title.length > 0) ? item.title[0] : '';
      if (!this.isTitleMatch(cleanTitle, matchedTitle)) {
        continue;
      }

      const volume = item.volume || '';
      const issue = item.issue || (item['journal-issue'] ? (item['journal-issue'].issue || '') : '');
      const pages = item.page || '';
      const doi = item.DOI || '';
      const fullVenue = (item['container-title'] && item['container-title'].length > 0) ? item['container-title'][0] : '';

      let fullAuthors = [];
      if (item.author && Array.isArray(item.author)) {
        fullAuthors = item.author.map(a => {
          if (a.given && a.family) return `${a.given} ${a.family}`;
          return a.family || a.name || '';
        }).filter(a => a.length > 0);
      }

      return { volume, issue, pages, doi, fullVenue, fullAuthors };
    }

    return null;
  },

  /**
   * Fetch OpenAlex Metadata API via Background Service Worker
   */
  fetchOpenAlexMetadata: async function(title) {
    if (!title || title.length < 5) return null;

    const cleanTitle = title
      .replace(/^(\[[^\]]+\]\s*)+/gi, '')
      .replace(/\.\.\.\s*$/, '')
      .replace(/…\s*$/, '')
      .replace(/[^\w\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const url = `https://api.openalex.org/works?search=${encodeURIComponent(cleanTitle)}&per_page=3&mailto=scholarcite.express@gmail.com`;
    const data = await this.callApi(url);
    if (!data.results || data.results.length === 0) return null;

    for (const work of data.results) {
      const candidateTitle = work.display_name || work.title || '';
      if (!this.isTitleMatch(cleanTitle, candidateTitle)) {
        continue;
      }

      const loc = work.biblio || {};
      const volume = loc.volume || '';
      const issue = loc.issue || '';
      let pages = '';
      if (loc.first_page) {
        pages = loc.first_page + (loc.last_page ? `-${loc.last_page}` : '');
      }

      const doi = work.doi ? work.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : '';
      const fullVenue = work.primary_location && work.primary_location.source ? work.primary_location.source.display_name : '';

      let fullAuthors = [];
      if (work.authorships && Array.isArray(work.authorships)) {
        fullAuthors = work.authorships.map(a => a.author ? a.author.display_name : '').filter(a => a.length > 0);
      }

      return { volume, issue, pages, doi, fullVenue, fullAuthors };
    }

    return null;
  },

  isTitleMatch: function(t1, t2) {
    if (!t1 || !t2) return false;

    const clean = (s) => s.toLowerCase()
      .replace(/<[^>]+>/g, '')
      .replace(/^(\[[^\]]+\]\s*)+/gi, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const s1 = clean(t1);
    const s2 = clean(t2);
    if (!s1 || !s2) return false;

    // Exact or direct normalized match
    if (s1 === s2) return true;

    // Direct substring check if length coverage is high
    const maxLen = Math.max(s1.length, s2.length);
    const minLen = Math.min(s1.length, s2.length);
    if ((s1.includes(s2) || s2.includes(s1)) && (minLen / maxLen >= 0.70)) {
      return true;
    }

    // Tokenized Jaccard similarity with stopword filtering
    const stopWords = new Set(['a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'are', 'was', 'were', 'using', 'based', 'via', 'study', 'towards', 'through']);
    const tokens1 = s1.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
    const tokens2 = s2.split(' ').filter(w => w.length > 2 && !stopWords.has(w));

    if (tokens1.length === 0 || tokens2.length === 0) {
      const all1 = s1.split(' ').filter(w => w.length > 0);
      const all2 = s2.split(' ').filter(w => w.length > 0);
      const set1 = new Set(all1);
      const inter = all2.filter(w => set1.has(w)).length;
      const union = new Set([...all1, ...all2]).size;
      return union > 0 && (inter / union >= 0.75);
    }

    const set1 = new Set(tokens1);
    let intersection = 0;
    tokens2.forEach(w => { if (set1.has(w)) intersection++; });
    const union = new Set([...tokens1, ...tokens2]).size;
    const jaccard = union > 0 ? (intersection / union) : 0;

    const minTokens = Math.min(tokens1.length, tokens2.length);
    const maxTokens = Math.max(tokens1.length, tokens2.length);
    const subsetOverlap = minTokens > 0 ? (intersection / minTokens) : 0;
    const tokenRatio = maxTokens > 0 ? (minTokens / maxTokens) : 0;

    if (jaccard >= 0.65 && intersection >= 2) return true;
    if (subsetOverlap >= 0.85 && tokenRatio >= 0.60 && intersection >= 3) return true;

    return false;
  },

  isSimilarTitle: function(t1, t2) {
    return this.isTitleMatch(t1, t2);
  },

  getStorageCache: function(key) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([`sc_cache_${key}`], res => {
          resolve(res[`sc_cache_${key}`] || null);
        });
      } else {
        resolve(null);
      }
    });
  },

  setStorageCache: function(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const obj = {};
      obj[`sc_cache_${key}`] = value;
      chrome.storage.local.set(obj);
    }
  }
};
