/**
 * ScholarCite Express - Robust Abstract & Open Access Engine
 * Multi-source lookup (DOI-First, OpenAlex, Crossref, Semantic Scholar) with clean title normalization,
 * rate-limit cooldown management, and background service worker proxying to bypass CSP/CORS blocks.
 */

window.ScholarAbstractFetcher = {
  abstractCache: {},
  s2CooldownUntil: 0,

  /**
   * Safe API Call Proxy: Routes request through Background Service Worker if available,
   * bypassing Content Security Policy (CSP) and CORS restrictions on scholar.google.com
   */
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
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}: ${res.statusText}`);
      err.status = res.status;
      throw err;
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return await res.json();
    }
    const text = await res.text();
    try { return JSON.parse(text); } catch (e) { return text; }
  },

  /**
   * Fetch full multi-paragraph abstract for a paper using multi-source fallbacks
   * @param {Object} paper 
   * @returns {Promise<Object>}
   */
  fetchAbstract: async function(paper) {
    if (!paper || !paper.title) return paper;
    const cacheKey = paper.cid || paper.doi || paper.title;

    if (this.abstractCache[cacheKey] && this.abstractCache[cacheKey].hasFullAbstract) {
      return Object.assign(paper, this.abstractCache[cacheKey]);
    }

    const storageCached = await this.getStorageCache(cacheKey);
    if (storageCached && storageCached.hasFullAbstract) {
      this.abstractCache[cacheKey] = storageCached;
      return Object.assign(paper, storageCached);
    }

    let resultData = {
      abstract: '',
      openAccessPdf: '',
      citationCount: 0,
      hasFullAbstract: false
    };

    // --- STRATEGY 0: DOI Lookup (100% Exact if DOI exists) ---
    if (paper.doi) {
      try {
        const doiData = await this.fetchByDoi(paper.doi);
        if (doiData && doiData.abstract && doiData.abstract.length > 50) {
          resultData.abstract = doiData.abstract;
          if (doiData.openAccessPdf) resultData.openAccessPdf = doiData.openAccessPdf;
          if (doiData.citationCount) resultData.citationCount = doiData.citationCount;
          resultData.hasFullAbstract = true;
        }
      } catch (e) {
        // Continue to title strategies
      }
    }

    const cleanTitle = this.normalizeTitle(paper.title);

    // --- STRATEGY 1: OpenAlex API (Primary: Fast, 100% free, no strict rate limits) ---
    if (!resultData.hasFullAbstract && cleanTitle) {
      try {
        const alexData = await this.fetchOpenAlex(cleanTitle);
        if (alexData && alexData.abstract && alexData.abstract.length > 50) {
          resultData.abstract = alexData.abstract;
          if (alexData.openAccessPdf) resultData.openAccessPdf = alexData.openAccessPdf;
          resultData.hasFullAbstract = true;
        }
      } catch (e) {
        // Fall through quietly
      }
    }

    // --- STRATEGY 2: Crossref API (Secondary: Publisher metadata & abstracts) ---
    if (!resultData.hasFullAbstract && cleanTitle) {
      try {
        const crData = await this.fetchCrossrefAbstract(cleanTitle);
        if (crData && crData.abstract && crData.abstract.length > 50) {
          resultData.abstract = crData.abstract;
          resultData.hasFullAbstract = true;
        }
      } catch (e) {
        // Fall through quietly
      }
    }

    // --- STRATEGY 3: Semantic Scholar API (Fallback with rate-limit cooldown check) ---
    if (!resultData.hasFullAbstract && cleanTitle && Date.now() > this.s2CooldownUntil) {
      try {
        const s2Data = await this.fetchSemanticScholar(cleanTitle);
        if (s2Data && s2Data.abstract && s2Data.abstract.length > 50) {
          resultData.abstract = s2Data.abstract;
          if (s2Data.openAccessPdf) resultData.openAccessPdf = s2Data.openAccessPdf;
          resultData.citationCount = s2Data.citationCount || 0;
          resultData.hasFullAbstract = true;
        }
      } catch (e) {
        if (e.message && e.message.includes('429')) {
          // Set a 3-minute cooldown timer for Semantic Scholar rate limits
          this.s2CooldownUntil = Date.now() + 180000;
        }
      }
    }

    // Fallback: If no API returns full abstract, use Scholar search snippet
    if (!resultData.abstract) {
      resultData.abstract = paper.snippet 
        ? (paper.snippet + ' [Note: Short search snippet displayed. Full text available via article link.]') 
        : 'Abstract not available via open academic APIs.';
    }

    this.abstractCache[cacheKey] = resultData;
    this.setStorageCache(cacheKey, resultData);

    return Object.assign(paper, resultData);
  },

  /**
   * Exact DOI Lookup against OpenAlex, Crossref, and Semantic Scholar
   */
  fetchByDoi: async function(doi) {
    if (!doi) return null;
    const cleanDoi = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();

    // 1. Try OpenAlex by DOI
    try {
      const url = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}?mailto=scholarcite.express@gmail.com`;
      const work = await this.callApi(url);
      if (work) {
        let abs = this.reconstructOpenAlexAbstract(work.abstract_inverted_index);
        if (abs && abs.length > 50) {
          return {
            abstract: abs,
            openAccessPdf: work.open_access ? work.open_access.oa_url : ''
          };
        }
      }
    } catch (e) {
      // Continue
    }

    // 2. Try Semantic Scholar by DOI if not on cooldown
    if (Date.now() > this.s2CooldownUntil) {
      try {
        const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${encodeURIComponent(cleanDoi)}?fields=title,abstract,citationCount,isOpenAccess,openAccessPdf`;
        const data = await this.callApi(url);
        if (data && data.abstract && data.abstract.length > 50) {
          return {
            abstract: data.abstract.trim(),
            openAccessPdf: data.openAccessPdf ? data.openAccessPdf.url : '',
            citationCount: data.citationCount || 0
          };
        }
      } catch (e) {
        if (e.message && e.message.includes('429')) {
          this.s2CooldownUntil = Date.now() + 180000;
        }
      }
    }

    return null;
  },

  /**
   * Clean and normalize title for search queries
   */
  normalizeTitle: function(rawTitle) {
    if (!rawTitle) return '';
    let cleaned = rawTitle
      .replace(/^(\[[^\]]+\]\s*)+/gi, '') // Strip all [PDF], [HTML], [BOOK], [CITATION], etc.
      .replace(/\.\.\.\s*$/, '')           // Strip trailing ellipsis ...
      .replace(/…\s*$/, '')               // Strip unicode ellipsis
      .replace(/["'”“’]/g, '')            // Strip quotes
      .replace(/[:\-–—\/\\]+/g, ' ')       // Replace colons and dashes with spaces
      .replace(/\s+/g, ' ')                // Normalize spaces
      .trim();

    return cleaned;
  },

  /**
   * OpenAlex API Abstract Fetcher
   */
  fetchOpenAlex: async function(title) {
    const cleanTitle = this.normalizeTitle(title);
    if (!cleanTitle || cleanTitle.length < 5) return null;

    const url = `https://api.openalex.org/works?search=${encodeURIComponent(cleanTitle)}&per_page=3&mailto=scholarcite.express@gmail.com`;
    const data = await this.callApi(url);
    if (!data || !data.results || data.results.length === 0) return null;

    for (let work of data.results) {
      const candidateTitle = work.display_name || work.title || '';
      if (!this.isTitleMatch(cleanTitle, candidateTitle)) {
        continue;
      }

      let abstractText = this.reconstructOpenAlexAbstract(work.abstract_inverted_index);
      if (abstractText && abstractText.length > 50) {
        const pdfUrl = work.open_access ? work.open_access.oa_url : '';
        return {
          abstract: abstractText,
          openAccessPdf: pdfUrl
        };
      }
    }

    return null;
  },

  /**
   * Crossref API Abstract Fetcher
   */
  fetchCrossrefAbstract: async function(title) {
    const cleanTitle = this.normalizeTitle(title);
    if (!cleanTitle || cleanTitle.length < 5) return null;

    const url = `https://api.crossref.org/works?query.title=${encodeURIComponent(cleanTitle)}&rows=3`;
    const data = await this.callApi(url);
    if (!data || !data.message) return null;
    const items = data.message.items || [];
    if (items.length === 0) return null;

    for (const item of items) {
      const candidateTitle = (item.title && item.title.length > 0) ? item.title[0] : '';
      if (!this.isTitleMatch(cleanTitle, candidateTitle)) {
        continue;
      }

      if (!item.abstract) continue;

      let cleanAbs = item.abstract
        .replace(/<jats:[^>]+>/g, '')
        .replace(/<\/jats:[^>]+>/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/^abstract\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      cleanAbs = this.decodeHTMLEntities(cleanAbs);
      if (cleanAbs.length > 50) {
        return { abstract: cleanAbs };
      }
    }

    return null;
  },

  /**
   * Semantic Scholar API Abstract Fetcher
   */
  fetchSemanticScholar: async function(title) {
    const cleanTitle = this.normalizeTitle(title);
    if (!cleanTitle || cleanTitle.length < 5) return null;

    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanTitle)}&limit=3&fields=title,abstract,citationCount,isOpenAccess,openAccessPdf`;
    const data = await this.callApi(url);
    if (!data || !data.data || data.data.length === 0) return null;

    for (let item of data.data) {
      if (!this.isTitleMatch(cleanTitle, item.title || '')) {
        continue;
      }

      if (item.abstract && item.abstract.length > 50) {
        const pdfUrl = item.openAccessPdf ? item.openAccessPdf.url : '';
        return {
          abstract: item.abstract.trim(),
          openAccessPdf: pdfUrl,
          citationCount: item.citationCount || 0
        };
      }
    }

    return null;
  },

  isTitleMatch: function(t1, t2) {
    if (window.ScholarEnricher && typeof window.ScholarEnricher.isTitleMatch === 'function') {
      return window.ScholarEnricher.isTitleMatch(t1, t2);
    }
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
    if (s1 === s2) return true;

    const maxLen = Math.max(s1.length, s2.length);
    const minLen = Math.min(s1.length, s2.length);
    if ((s1.includes(s2) || s2.includes(s1)) && (minLen / maxLen >= 0.70)) {
      return true;
    }

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

  reconstructOpenAlexAbstract: function(invertedIndex) {
    if (!invertedIndex) return '';
    const words = [];
    for (const [word, posList] of Object.entries(invertedIndex)) {
      posList.forEach(pos => { words[pos] = word; });
    }
    return words.join(' ').replace(/\s+/g, ' ').trim();
  },

  decodeHTMLEntities: function(text) {
    if (!text) return '';
    return text
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  },

  getStorageCache: function(key) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([`sc_abs_${key}`], res => {
          resolve(res[`sc_abs_${key}`] || null);
        });
      } else {
        resolve(null);
      }
    });
  },

  setStorageCache: function(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      const obj = {};
      obj[`sc_abs_${key}`] = value;
      chrome.storage.local.set(obj);
    }
  }
};
