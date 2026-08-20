/**
 * ScholarCite Express - Standalone Web Application Controller
 * High-speed client-side academic search, multi-style citation engine,
 * live metadata enricher, research cart accumulator, and multi-format LLM exporter.
 */

(function() {
  'use strict';

  // Application State
  let currentPapers = [];
  let cartPapers = {};
  let activeStyle = 'apa';
  let excludePreprints = false;
  let excludeIncomplete = false;
  let currentQuery = '';
  let isLoading = false;

  // Initialize Application
  document.addEventListener('DOMContentLoaded', () => {
    loadSavedCart();
    setupEventListeners();
    
    // Auto-load default research topic on initial visit
    const defaultTopic = 'Generative AI in Higher Education';
    const searchInput = document.getElementById('web-search-input');
    if (searchInput) searchInput.value = defaultTopic;
    executeSearch(defaultTopic);
  });

  function loadSavedCart() {
    try {
      const saved = localStorage.getItem('scholarcite_web_cart');
      if (saved) {
        cartPapers = JSON.parse(saved);
        updateCartBadge();
      }
    } catch (e) {
      cartPapers = {};
    }
  }

  function saveCart() {
    try {
      localStorage.setItem('scholarcite_web_cart', JSON.stringify(cartPapers));
    } catch (e) {}
    updateCartBadge();
  }

  function updateCartBadge() {
    const count = Object.keys(cartPapers).length;
    const badge = document.getElementById('nav-cart-count');
    if (badge) badge.innerText = count;
  }

  function setupEventListeners() {
    // Search Form
    const searchForm = document.getElementById('web-search-form');
    if (searchForm) {
      searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = document.getElementById('web-search-input');
        if (input && input.value.trim()) {
          executeSearch(input.value.trim());
        }
      });
    }

    // Quick Topic Pills
    document.querySelectorAll('.topic-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const topic = pill.getAttribute('data-topic');
        const input = document.getElementById('web-search-input');
        if (input && topic) {
          input.value = topic;
          executeSearch(topic);
        }
      });
    });

    // Style Selectors
    document.querySelectorAll('.style-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeStyle = btn.getAttribute('data-style');
        renderResults();
      });
    });

    // Filter Checkboxes
    const chkPreprints = document.getElementById('chk-exclude-preprints');
    if (chkPreprints) {
      chkPreprints.addEventListener('change', (e) => {
        excludePreprints = e.target.checked;
        renderResults();
      });
    }

    const chkIncomplete = document.getElementById('chk-exclude-incomplete');
    if (chkIncomplete) {
      chkIncomplete.addEventListener('change', (e) => {
        excludeIncomplete = e.target.checked;
        renderResults();
      });
    }

    // Main Action Buttons
    const btnCopyAll = document.getElementById('btn-copy-all');
    if (btnCopyAll) {
      btnCopyAll.addEventListener('click', () => {
        const visible = getFilteredPapers();
        if (visible.length === 0) return;
        const text = visible.map(p => window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(p, activeStyle) : p.title).join('\n\n');
        navigator.clipboard.writeText(text).then(() => {
          const orig = btnCopyAll.innerHTML;
          btnCopyAll.innerHTML = '✓ Copied Citations!';
          setTimeout(() => { btnCopyAll.innerHTML = orig; }, 2000);
        });
      });
    }

    const btnAddAllCart = document.getElementById('btn-add-all-cart');
    if (btnAddAllCart) {
      btnAddAllCart.addEventListener('click', () => {
        const visible = getFilteredPapers();
        let added = 0;
        visible.forEach(p => {
          const key = p.doi || p.cid || p.title.toLowerCase().trim();
          if (!cartPapers[key]) {
            cartPapers[key] = p;
            added++;
          }
        });
        saveCart();
        renderResults();
        const orig = btnAddAllCart.innerHTML;
        btnAddAllCart.innerHTML = `✓ Added ${added} New!`;
        setTimeout(() => { btnAddAllCart.innerHTML = orig; }, 2000);
      });
    }

    const btnExportModal = document.getElementById('btn-open-export-modal');
    if (btnExportModal) {
      btnExportModal.addEventListener('click', () => openExportModal('search'));
    }

    const btnNavCart = document.getElementById('btn-nav-cart');
    if (btnNavCart) {
      btnNavCart.addEventListener('click', () => openCartModal());
    }

    const btnGodMode = document.getElementById('btn-god-mode-top');
    if (btnGodMode) {
      btnGodMode.addEventListener('click', () => openPromptsModal('godmode'));
    }

    const btnInstallGuide = document.getElementById('btn-install-guide');
    if (btnInstallGuide) {
      btnInstallGuide.addEventListener('click', (e) => {
        e.preventDefault();
        openInstallModal();
      });
    }
  }

  /**
   * Execute Academic Search against OpenAlex with Crossref Fallback
   */
  async function executeSearch(query) {
    if (!query) return;
    currentQuery = query;
    isLoading = true;

    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="loading-box">
          <div class="loading-spinner"></div>
          <p>Searching OpenAlex & Crossref global academic records for <strong>"${escapeHTML(query)}"</strong>...</p>
        </div>
      `;
    }

    try {
      // 1. Fetch from OpenAlex
      const cleanQ = query.replace(/[^\w\s]/gi, ' ').trim();
      const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQ)}&per_page=20&mailto=scholarcite.express@gmail.com`;
      
      let fetchedWorks = [];
      try {
        const res = await fetch(openAlexUrl);
        if (res.ok) {
          const data = await res.json();
          if (data && data.results && data.results.length > 0) {
            fetchedWorks = data.results.map((work, idx) => transformOpenAlexWork(work, idx + 1));
          }
        }
      } catch (err) {
        console.warn('OpenAlex fetch error, trying Crossref fallback...', err);
      }

      // 2. Crossref fallback if OpenAlex returned nothing
      if (fetchedWorks.length === 0) {
        const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(cleanQ)}&rows=15`;
        const resCr = await fetch(crossrefUrl);
        if (resCr.ok) {
          const crData = await resCr.json();
          if (crData.message && crData.message.items) {
            fetchedWorks = crData.message.items.map((item, idx) => transformCrossrefItem(item, idx + 1));
          }
        }
      }

      currentPapers = fetchedWorks;
      isLoading = false;
      renderResults();
    } catch (e) {
      isLoading = false;
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="loading-box">
            <p style="color: #f87171;">Unable to connect to academic APIs right now. Please check your internet connection and try again.</p>
          </div>
        `;
      }
    }
  }

  function transformOpenAlexWork(work, index) {
    const loc = work.biblio || {};
    const fullAuthors = (work.authorships || []).map(a => a.author ? a.author.display_name : '').filter(Boolean);
    const authors = fullAuthors.length > 0 ? fullAuthors : ['Unknown Author'];

    let pages = '';
    if (loc.first_page) {
      pages = loc.first_page + (loc.last_page ? `-${loc.last_page}` : '');
    }

    let abstract = '';
    if (work.abstract_inverted_index) {
      abstract = reconstructInvertedIndex(work.abstract_inverted_index);
    }

    let type = 'journal';
    const workType = (work.type || '').toLowerCase();
    if (workType.includes('book') || workType.includes('chapter')) type = 'book';
    else if (workType.includes('proceedings') || workType.includes('conference')) type = 'conference';
    else if (workType.includes('preprint') || workType.includes('posted-content')) type = 'preprint';

    return {
      index: index,
      title: work.display_name || work.title || 'Untitled Publication',
      authors: authors,
      fullAuthors: fullAuthors,
      authorString: authors.join(', '),
      year: work.publication_year ? String(work.publication_year) : 'n.d.',
      venue: work.primary_location && work.primary_location.source ? work.primary_location.source.display_name : '',
      fullVenue: work.primary_location && work.primary_location.source ? work.primary_location.source.display_name : '',
      volume: loc.volume || '',
      issue: loc.issue || '',
      pages: pages,
      doi: work.doi ? work.doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '') : '',
      url: work.doi || (work.primary_location ? work.primary_location.landing_page_url : ''),
      openAccessPdf: work.open_access ? work.open_access.oa_url : '',
      citeCount: work.cited_by_count || 0,
      abstract: abstract,
      type: type,
      isEnriched: true
    };
  }

  function transformCrossrefItem(item, index) {
    const fullAuthors = (item.author || []).map(a => {
      if (a.given && a.family) return `${a.given} ${a.family}`;
      return a.family || a.name || '';
    }).filter(Boolean);

    let year = '';
    if (item.published && item.published['date-parts'] && item.published['date-parts'][0]) {
      year = String(item.published['date-parts'][0][0]);
    }

    let cleanAbs = item.abstract ? item.abstract.replace(/<[^>]+>/g, '').replace(/^abstract\s*/i, '').trim() : '';

    return {
      index: index,
      title: (item.title && item.title.length > 0) ? item.title[0] : 'Untitled Publication',
      authors: fullAuthors.length > 0 ? fullAuthors : ['Unknown Author'],
      fullAuthors: fullAuthors,
      authorString: fullAuthors.join(', '),
      year: year || 'n.d.',
      venue: (item['container-title'] && item['container-title'].length > 0) ? item['container-title'][0] : '',
      fullVenue: (item['container-title'] && item['container-title'].length > 0) ? item['container-title'][0] : '',
      volume: item.volume || '',
      issue: item.issue || '',
      pages: item.page || '',
      doi: item.DOI || '',
      url: item.DOI ? `https://doi.org/${item.DOI}` : (item.URL || ''),
      openAccessPdf: (item.link && item.link.length > 0 && item.link[0].URL) ? item.link[0].URL : '',
      citeCount: item['is-referenced-by-count'] || 0,
      abstract: cleanAbs,
      type: 'journal',
      isEnriched: true
    };
  }

  function reconstructInvertedIndex(invertedIndex) {
    if (!invertedIndex) return '';
    const words = [];
    for (const [word, posList] of Object.entries(invertedIndex)) {
      posList.forEach(pos => { words[pos] = word; });
    }
    return words.join(' ').replace(/\s+/g, ' ').trim();
  }

  function getFilteredPapers() {
    let list = currentPapers;
    if (excludePreprints) {
      list = list.filter(p => p.type !== 'preprint');
    }
    if (excludeIncomplete) {
      list = list.filter(p => p.title && p.title.trim().length > 0 && p.authors.length > 0);
    }
    return list;
  }

  function renderResults() {
    const container = document.getElementById('results-container');
    if (!container) return;

    const visible = getFilteredPapers();
    updateMetrics(visible);

    const countBadge = document.getElementById('results-count-label');
    if (countBadge) {
      countBadge.innerText = `(${visible.length} Papers Found)`;
    }

    if (visible.length === 0) {
      container.innerHTML = `
        <div class="loading-box">
          <p>No research papers found matching current filters. Try relaxing the filters or entering a different search term.</p>
        </div>
      `;
      return;
    }

    let html = '';
    visible.forEach((paper, idx) => {
      const key = paper.doi || paper.cid || paper.title.toLowerCase().trim();
      const inCart = !!cartPapers[key];
      const formattedCit = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(paper, activeStyle) : paper.title;
      
      const typeLabels = {
        journal: '📰 JOURNAL',
        book: '📚 BOOK',
        conference: '🏛️ CONFERENCE',
        preprint: '📄 PREPRINT'
      };

      const kwBadges = extractKeywords(paper.title, paper.abstract);
      const kwHTML = kwBadges.map(kw => `<span class="badge badge-kw">${kw}</span>`).join('');
      const impactHTML = getImpactBadge(paper.citeCount);

      html += `
        <div class="paper-card" id="paper-card-${idx}">
          <div class="paper-card-header">
            <div class="paper-badges">
              <span class="badge badge-rank">#${idx + 1}</span>
              <span class="badge badge-${paper.type}">${typeLabels[paper.type] || '📰 JOURNAL'}</span>
              ${impactHTML}
              ${kwHTML}
            </div>
            
            <div class="paper-actions">
              <button class="card-btn btn-toggle-abs" data-idx="${idx}">
                📖 Abstract
              </button>
              ${paper.openAccessPdf ? `
                <a href="${paper.openAccessPdf}" target="_blank" rel="noopener noreferrer" class="card-btn card-btn-oa" title="Download Free Legal PDF">
                  🔓 Open Access PDF
                </a>
              ` : ''}
              ${paper.doi ? `
                <a href="https://doi.org/${paper.doi}" target="_blank" rel="noopener noreferrer" class="card-btn" title="Open Publisher DOI Link">
                  🌐 DOI
                </a>
              ` : ''}
              <button class="card-btn card-btn-cart ${inCart ? 'in-cart' : ''}" data-idx="${idx}">
                ${inCart ? '✓ In Cart' : '🛒 +Cart'}
              </button>
              <button class="card-btn btn-copy-single" data-idx="${idx}">
                📋 Copy
              </button>
            </div>
          </div>

          <div class="paper-citation-text">${escapeHTML(formattedCit)}</div>

          <div class="abstract-drawer" id="abs-drawer-${idx}" style="display: none;">
            <div class="abstract-header">
              <span>Full Abstract & Summary</span>
              <button class="card-btn btn-copy-note" data-idx="${idx}">📋 Copy Note</button>
            </div>
            <p>${paper.abstract ? escapeHTML(paper.abstract) : '<em>Abstract not indexed in public records. Full text available via publisher/open access link.</em>'}</p>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach card event handlers
    container.querySelectorAll('.btn-toggle-abs').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = e.currentTarget.getAttribute('data-idx');
        const drawer = document.getElementById(`abs-drawer-${idx}`);
        if (drawer) {
          drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
        }
      });
    });

    container.querySelectorAll('.card-btn-cart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        const paper = visible[idx];
        if (!paper) return;
        const key = paper.doi || paper.cid || paper.title.toLowerCase().trim();
        if (cartPapers[key]) {
          delete cartPapers[key];
        } else {
          cartPapers[key] = paper;
        }
        saveCart();
        renderResults();
      });
    });

    container.querySelectorAll('.btn-copy-single').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        const paper = visible[idx];
        if (!paper) return;
        const text = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(paper, activeStyle) : paper.title;
        navigator.clipboard.writeText(text).then(() => {
          const orig = btn.innerHTML;
          btn.innerHTML = '✓ Copied!';
          setTimeout(() => { btn.innerHTML = orig; }, 1500);
        });
      });
    });

    container.querySelectorAll('.btn-copy-note').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        const paper = visible[idx];
        if (!paper) return;
        const currentCit = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(paper, activeStyle) : paper.title;
        const note = `## ${paper.title}\n\n**Citation (${activeStyle.toUpperCase()})**:\n${currentCit}\n\n**Abstract**:\n${paper.abstract || 'N/A'}`;
        navigator.clipboard.writeText(note).then(() => {
          const orig = btn.innerHTML;
          btn.innerHTML = '✓ Note Copied!';
          setTimeout(() => { btn.innerHTML = orig; }, 1500);
        });
      });
    });
  }

  function updateMetrics(papers) {
    const metrics = window.ScholarExportEngine ? window.ScholarExportEngine.calculateMetrics(papers) : { totalCitations: 0, avgCitations: 0, hIndex: 0, highlyCitedCount: 0 };
    
    const mTotal = document.getElementById('metric-total-cites');
    if (mTotal) mTotal.innerText = metrics.totalCitations.toLocaleString();

    const mAvg = document.getElementById('metric-avg-cites');
    if (mAvg) mAvg.innerText = metrics.avgCitations.toLocaleString();

    const mHIndex = document.getElementById('metric-h-index');
    if (mHIndex) mHIndex.innerText = metrics.hIndex;

    const mHigh = document.getElementById('metric-high-count');
    if (mHigh) mHigh.innerText = metrics.highlyCitedCount;
  }

  function extractKeywords(title, abstract) {
    const text = `${title} ${abstract || ''}`.toLowerCase();
    const keywords = [];
    if (text.includes('empirical')) keywords.push('#Empirical');
    else if (text.includes('survey')) keywords.push('#Survey');
    else if (text.includes('meta-analysis')) keywords.push('#MetaAnalysis');

    if (text.includes('framework')) keywords.push('#Framework');
    else if (text.includes('model')) keywords.push('#Model');
    else if (text.includes('algorithm')) keywords.push('#Algorithm');

    if (text.includes('deep learning')) keywords.push('#DeepLearning');
    else if (text.includes('machine learning')) keywords.push('#MachineLearning');
    else if (text.includes('ai') || text.includes('artificial intelligence')) keywords.push('#AI');
    return keywords.slice(0, 2);
  }

  function getImpactBadge(citeCount) {
    if (!citeCount || citeCount === 0) {
      return `<span class="badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8;">🌱 Emerging</span>`;
    } else if (citeCount >= 100) {
      return `<span class="badge badge-impact-high">🔥 Highly Cited (${citeCount.toLocaleString()})</span>`;
    } else if (citeCount >= 25) {
      return `<span class="badge badge-impact-mid">⭐ Influential (${citeCount.toLocaleString()})</span>`;
    } else {
      return `<span class="badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399;">🌱 Cited (${citeCount})</span>`;
    }
  }

  /**
   * Open Research Cart Modal
   */
  function openCartModal() {
    const existing = document.getElementById('modal-cart-view');
    if (existing) existing.remove();

    const papers = Object.values(cartPapers);

    const modal = document.createElement('div');
    modal.id = 'modal-cart-view';
    modal.className = 'modal-backdrop';

    let itemsHTML = '';
    if (papers.length === 0) {
      itemsHTML = '<p style="color: #94a3b8; text-align:center; padding: 30px 0;">Your Research Cart is empty. Click "🛒 +Cart" on any paper card to accumulate papers across searches!</p>';
    } else {
      papers.forEach((p, idx) => {
        const cit = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(p, activeStyle) : p.title;
        itemsHTML += `
          <div style="background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
              <strong style="font-size: 13.5px; color: #38bdf8;">#${idx + 1} ${escapeHTML(p.title)}</strong>
              <button class="btn-remove-cart-item" data-key="${p.doi || p.cid || p.title.toLowerCase().trim()}" style="background:none; border:none; color:#f87171; font-weight:bold; cursor:pointer; font-size:16px;">&times;</button>
            </div>
            <p style="font-size: 12.5px; color: #cbd5e1; margin-top: 6px;">${escapeHTML(cit)}</p>
          </div>
        `;
      });
    }

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>🛒 Research Cart (${papers.length} Papers Accumulated)</h3>
          <button class="modal-close" id="modal-cart-close">&times;</button>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 16px;">
          <button id="btn-export-cart-now" class="act-btn act-btn-primary" ${papers.length === 0 ? 'disabled' : ''} style="flex:1;">
            📥 Export Research Cart Dataset
          </button>
          <button id="btn-clear-cart-all" class="act-btn" ${papers.length === 0 ? 'disabled' : ''} style="color:#f87171;">
            🗑️ Clear Cart
          </button>
        </div>

        <div style="max-height: 400px; overflow-y: auto;">
          ${itemsHTML}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-cart-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const btnClear = modal.querySelector('#btn-clear-cart-all');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        cartPapers = {};
        saveCart();
        modal.remove();
        renderResults();
      });
    }

    const btnExpCart = modal.querySelector('#btn-export-cart-now');
    if (btnExpCart) {
      btnExpCart.addEventListener('click', () => {
        modal.remove();
        openExportModal('cart');
      });
    }

    modal.querySelectorAll('.btn-remove-cart-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const k = e.currentTarget.getAttribute('data-key');
        if (k && cartPapers[k]) {
          delete cartPapers[k];
          saveCart();
          modal.remove();
          openCartModal();
          renderResults();
        }
      });
    });
  }

  /**
   * Open Multi-Format Export Modal
   */
  function openExportModal(source = 'search') {
    const existing = document.getElementById('modal-export-view');
    if (existing) existing.remove();

    const papers = source === 'cart' ? Object.values(cartPapers) : getFilteredPapers();
    if (papers.length === 0) {
      alert('No papers available to export.');
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'modal-export-view';
    modal.className = 'modal-backdrop';

    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📥 Export Dataset (${papers.length} Papers &bull; ${source === 'cart' ? 'Research Cart' : 'Search Results'})</h3>
          <button class="modal-close" id="modal-export-close">&times;</button>
        </div>

        <p style="font-size: 13px; color: #94a3b8; margin-bottom: 20px;">
          Select your target format. All generated files are clean, publication-ready, and contain zero branding watermarks.
        </p>

        <div class="export-grid">
          <div class="exp-tile" id="exp-action-md">
            <div class="exp-tile-title">📝 Markdown (.md)</div>
            <div class="exp-tile-desc">Includes benchmark metrics & pre-formatted LLM literature review prompts.</div>
          </div>

          <div class="exp-tile" id="exp-action-docx-ref">
            <div class="exp-tile-title">📄 Word References (.doc)</div>
            <div class="exp-tile-desc">Formatted Microsoft Word references with hanging indents in ${activeStyle.toUpperCase()}.</div>
          </div>

          <div class="exp-tile" id="exp-action-docx-abs">
            <div class="exp-tile-title">📚 Annotated Bibliography</div>
            <div class="exp-tile-desc">Formatted Word document including full citations and complete abstracts.</div>
          </div>

          <div class="exp-tile" id="exp-action-json">
            <div class="exp-tile-title">📊 JSON Schema (.json)</div>
            <div class="exp-tile-desc">Clean structured JSON schema for AI Agents, Python RAG, and LangChain pipelines.</div>
          </div>

          <div class="exp-tile" id="exp-action-bib">
            <div class="exp-tile-title">🏷️ BibTeX (.bib)</div>
            <div class="exp-tile-desc">Complete BibTeX entries with DOIs, volume, and pages for LaTeX & Overleaf.</div>
          </div>

          <div class="exp-tile" id="exp-action-ris">
            <div class="exp-tile-title">📁 RIS (.ris)</div>
            <div class="exp-tile-desc">Universal research citation format for EndNote, Zotero, and Mendeley.</div>
          </div>

          <div class="exp-tile" id="exp-action-oa">
            <div class="exp-tile-title">🔓 Open Access PDF Links</div>
            <div class="exp-tile-desc">Text file with direct download links to legal open access full texts.</div>
          </div>
        </div>

        <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 14px;">
          <h4 style="font-size: 13.5px; color: #38bdf8; font-weight: 700; margin-bottom: 6px;">🤖 Academic LLM Prompts Ready</h4>
          <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.4; margin-bottom: 10px;">
            Copy prompt templates specifically tuned for Gemini, NotebookLM, ChatGPT, and Claude to synthesize this dataset.
          </p>
          <button id="btn-open-prompts-from-export" class="act-btn act-btn-god" style="font-size: 12px; padding: 6px 14px;">
            👑 View & Copy LLM Prompts
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-export-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#exp-action-md').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportData(papers, 'markdown', activeStyle, currentQuery);
    });

    modal.querySelector('#exp-action-json').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportData(papers, 'json', activeStyle, currentQuery);
    });

    modal.querySelector('#exp-action-bib').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportData(papers, 'bibtex', activeStyle, currentQuery);
    });

    modal.querySelector('#exp-action-ris').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportData(papers, 'ris', activeStyle, currentQuery);
    });

    modal.querySelector('#exp-action-oa').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportPDFLinks(papers, currentQuery);
    });

    modal.querySelector('#exp-action-docx-ref').addEventListener('click', () => {
      if (window.ScholarDocxGenerator) window.ScholarDocxGenerator.downloadWordDocument(papers, activeStyle, currentQuery, false);
    });

    modal.querySelector('#exp-action-docx-abs').addEventListener('click', () => {
      if (window.ScholarDocxGenerator) window.ScholarDocxGenerator.downloadWordDocument(papers, activeStyle, currentQuery, true);
    });

    modal.querySelector('#btn-open-prompts-from-export').addEventListener('click', () => {
      modal.remove();
      openPromptsModal('godmode');
    });
  }

  /**
   * Open Academic LLM Prompts Modal
   */
  function openPromptsModal(activePromptKey = 'godmode') {
    const existing = document.getElementById('modal-prompts-view');
    if (existing) existing.remove();

    const prompts = window.ScholarExportEngine ? window.ScholarExportEngine.getLLMPrompts() : {};

    const modal = document.createElement('div');
    modal.id = 'modal-prompts-view';
    modal.className = 'modal-backdrop';

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 820px;">
        <div class="modal-header">
          <h3>👑 Academic LLM Prompts (Gemini &bull; NotebookLM &bull; ChatGPT &bull; Claude)</h3>
          <button class="modal-close" id="modal-prompts-close">&times;</button>
        </div>

        <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 16px;">
          <button class="prompt-tab-btn act-btn ${activePromptKey === 'godmode' ? 'act-btn-god' : ''}" data-key="godmode">👑 God-Mode Full Paper</button>
          <button class="prompt-tab-btn act-btn ${activePromptKey === 'synthesis' ? 'act-btn-primary' : ''}" data-key="synthesis">📋 Synthesis</button>
          <button class="prompt-tab-btn act-btn ${activePromptKey === 'gaps' ? 'act-btn-primary' : ''}" data-key="gaps">🔍 Research Gaps</button>
          <button class="prompt-tab-btn act-btn ${activePromptKey === 'methodology' ? 'act-btn-primary' : ''}" data-key="methodology">📊 Methodology Matrix</button>
          <button class="prompt-tab-btn act-btn ${activePromptKey === 'theory' ? 'act-btn-primary' : ''}" data-key="theory">💡 Theoretical Model</button>
          <button class="prompt-tab-btn act-btn ${activePromptKey === 'conflicts' ? 'act-btn-primary' : ''}" data-key="conflicts">🥊 Conflicting Findings</button>
          <button class="prompt-tab-btn act-btn ${activePromptKey === 'implications' ? 'act-btn-primary' : ''}" data-key="implications">⚡ Policy Implications</button>
        </div>

        <div style="background: #090d16; border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 8px; padding: 18px; position: relative;">
          <button id="btn-copy-prompt-text" class="act-btn act-btn-primary" style="position: absolute; top: 12px; right: 12px; font-size: 11.5px; padding: 5px 12px;">
            📋 Copy Prompt
          </button>
          <pre id="prompt-display-text" style="font-family: var(--font-mono); font-size: 12.5px; color: #cbd5e1; white-space: pre-wrap; word-break: break-word; line-height: 1.5; max-height: 380px; overflow-y: auto; padding-top: 10px;">${escapeHTML(prompts[activePromptKey] || '')}</pre>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-prompts-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.prompt-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const k = e.currentTarget.getAttribute('data-key');
        modal.querySelectorAll('.prompt-tab-btn').forEach(b => {
          b.classList.remove('act-btn-primary', 'act-btn-god');
        });
        if (k === 'godmode') btn.classList.add('act-btn-god'); else btn.classList.add('act-btn-primary');
        const display = modal.querySelector('#prompt-display-text');
        if (display && prompts[k]) display.innerText = prompts[k];
      });
    });

    const btnCopy = modal.querySelector('#btn-copy-prompt-text');
    btnCopy.addEventListener('click', () => {
      const display = modal.querySelector('#prompt-display-text');
      if (display) {
        navigator.clipboard.writeText(display.innerText).then(() => {
          btnCopy.innerText = '✓ Prompt Copied!';
          setTimeout(() => { btnCopy.innerText = '📋 Copy Prompt'; }, 2000);
        });
      }
    });
  }

  /**
   * Open 30-Second Chrome Installation Modal
   */
  function openInstallModal() {
    const existing = document.getElementById('modal-install-view');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-install-view';
    modal.className = 'modal-backdrop';

    modal.innerHTML = `
      <div class="modal-content" style="max-width: 680px;">
        <div class="modal-header">
          <h3>⚡ Install ScholarCite Express in Chrome (30 Seconds)</h3>
          <button class="modal-close" id="modal-install-close">&times;</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 20px;">
          <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 14px; display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 24px;">📥</span>
            <div>
              <strong style="color: #38bdf8; font-size: 14px;">Step 1: Download & Unzip</strong>
              <p style="font-size: 12.5px; color: #cbd5e1; margin-top: 2px;">Download <code>scholarcite-express-v1.2.0.zip</code> and extract/unzip the folder to your computer.</p>
            </div>
          </div>

          <div style="background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 10px; padding: 14px; display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 24px;">🧩</span>
            <div>
              <strong style="color: #38bdf8; font-size: 14px;">Step 2: Open Extensions in Chrome</strong>
              <p style="font-size: 12.5px; color: #cbd5e1; margin-top: 2px;">In Google Chrome, navigate to <code>chrome://extensions</code> in your URL address bar.</p>
            </div>
          </div>

          <div style="background: #1e293b; border: 1px solid rgba(51, 65, 85, 0.8); border-radius: 10px; padding: 14px; display: flex; gap: 12px; align-items: center;">
            <span style="font-size: 24px;">🛠️</span>
            <div>
              <strong style="color: #38bdf8; font-size: 14px;">Step 3: Enable Developer Mode & Load Unpacked</strong>
              <p style="font-size: 12.5px; color: #cbd5e1; margin-top: 2px;">Toggle <strong>"Developer mode"</strong> (top right switch) &rarr; Click <strong>"Load unpacked"</strong> &rarr; Select the unzipped extension folder.</p>
            </div>
          </div>
        </div>

        <div style="text-align: center;">
          <a href="scholarcite-express-v1.2.0.zip" download="scholarcite-express-v1.2.0.zip" class="act-btn act-btn-primary" style="display: inline-flex; font-size: 15px; padding: 12px 28px;">
            📥 Download Extension ZIP Now
          </a>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-install-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
})();
