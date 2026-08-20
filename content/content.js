/**
 * ScholarCite Express - Content Script (Premium Overlay & Dock)
 * Injects glassmorphic dock, color-coded badges, abstract drawers, export modals,
 * item quantity limits (5, 10, 15, 20, All), preprint exclusion, incomplete citation filtering,
 * and Multi-Page Research Cart Accumulator.
 */

(function() {
  'use strict';

  let activeStyle = 'apa';
  let exportLimit = '20';
  let excludePreprints = false;
  let excludeIncomplete = false;
  let autoAccumulate = false;
  let exportSourceMode = 'page'; // 'page' | 'cart'
  let parsedPapers = [];
  let savedPapersMap = {};
  let cartPapersMap = {};

  function getCurrentSearchQuery() {
    const input = document.querySelector('input[name="q"]');
    return input ? input.value.trim().toLowerCase() : '';
  }

  function init() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'scholarCiteStyle', 
        'scholarCiteSaved', 
        'scholarCiteCart',
        'scholarCiteExportLimit', 
        'scholarCiteExcludePreprints',
        'scholarCiteExcludeIncomplete',
        'scholarCiteAutoAccumulate',
        'scholarCiteLastQuery'
      ], function(result) {
        if (result.scholarCiteStyle) activeStyle = result.scholarCiteStyle;
        if (result.scholarCiteSaved) savedPapersMap = result.scholarCiteSaved;
        if (result.scholarCiteCart) cartPapersMap = result.scholarCiteCart;
        if (result.scholarCiteExportLimit) exportLimit = result.scholarCiteExportLimit;
        if (typeof result.scholarCiteExcludePreprints !== 'undefined') excludePreprints = !!result.scholarCiteExcludePreprints;
        if (typeof result.scholarCiteExcludeIncomplete !== 'undefined') excludeIncomplete = !!result.scholarCiteExcludeIncomplete;
        autoAccumulate = result.scholarCiteAutoAccumulate === true;

        // Reset Research Cart if starting a brand new search topic query
        const currentQuery = getCurrentSearchQuery();
        if (currentQuery && result.scholarCiteLastQuery && result.scholarCiteLastQuery !== currentQuery) {
          cartPapersMap = {};
          chrome.storage.local.set({ 
            scholarCiteCart: {}, 
            scholarCiteLastQuery: currentQuery 
          });
        } else if (currentQuery) {
          chrome.storage.local.set({ scholarCiteLastQuery: currentQuery });
        }

        renderExtensionUI();
      });

      chrome.storage.onChanged.addListener(function(changes, namespace) {
        if (namespace === 'local') {
          if (changes.scholarCiteStyle) {
            activeStyle = changes.scholarCiteStyle.newValue;
            updateAllCitations();
            updateToolbarSelectState();
          }
          if (changes.scholarCiteSaved) {
            savedPapersMap = changes.scholarCiteSaved.newValue || {};
            updateAllSaveButtons();
          }
          if (changes.scholarCiteCart) {
            cartPapersMap = changes.scholarCiteCart.newValue || {};
            updateCartUIState();
          }
          if (changes.scholarCiteExportLimit) {
            exportLimit = changes.scholarCiteExportLimit.newValue;
            updateToolbarSelectState();
          }
          if (changes.scholarCiteExcludePreprints) {
            excludePreprints = !!changes.scholarCiteExcludePreprints.newValue;
            applyPaperFilters();
            updateToolbarSelectState();
          }
          if (changes.scholarCiteExcludeIncomplete) {
            excludeIncomplete = !!changes.scholarCiteExcludeIncomplete.newValue;
            applyPaperFilters();
            updateToolbarSelectState();
          }
          if (changes.scholarCiteAutoAccumulate) {
            autoAccumulate = !!changes.scholarCiteAutoAccumulate.newValue;
            updateToolbarSelectState();
          }
        }
      });
    } else {
      renderExtensionUI();
    }
  }

  async function renderExtensionUI() {
    if (window.ScholarDOMParser) {
      parsedPapers = window.ScholarDOMParser.parsePageResults();
      window.scholarCiteCurrentPapers = parsedPapers;
    }

    if (!parsedPapers || parsedPapers.length === 0) return;

    injectFloatingDock();

    // Synchronously render all card overlays immediately
    parsedPapers.forEach(paper => {
      injectInlineCard(paper);
    });

    applyPaperFilters();

    // Auto-Accumulate into Research Cart if mode is enabled
    if (autoAccumulate) {
      accumulateCurrentPageToCart(false);
    }

    // Asynchronously load storage cache in background without blocking rendering
    for (let paper of parsedPapers) {
      try {
        if (window.ScholarEnricher) {
          const cacheKey = paper.cid || paper.title;
          const stored = await window.ScholarEnricher.getStorageCache(cacheKey);
          if (stored) {
            Object.assign(paper, stored, { isEnriched: true });
            updateCardUI(paper);
          }
        }

        if (window.ScholarAbstractFetcher) {
          const absCacheKey = paper.cid || paper.doi || paper.title;
          const storedAbs = await window.ScholarAbstractFetcher.getStorageCache(absCacheKey);
          if (storedAbs) {
            Object.assign(paper, storedAbs);
            updateCardUI(paper);
          }
        }
      } catch (err) {
        // Fall through quietly
      }
    }
  }

  function getPaperKey(paper) {
    return paper.cid || paper.doi || paper.title.toLowerCase().trim();
  }

  function accumulateCurrentPageToCart(showFeedback = true) {
    const visible = getFilteredPagePapers();
    let addedCount = 0;

    visible.forEach(paper => {
      const key = getPaperKey(paper);
      if (!cartPapersMap[key]) {
        cartPapersMap[key] = paper;
        addedCount++;
      }
    });

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ scholarCiteCart: cartPapersMap });
    }

    updateCartUIState();

    if (showFeedback) {
      const btn = document.getElementById('sc-btn-add-page-cart');
      if (btn) {
        const origText = btn.innerHTML;
        btn.innerText = `✓ Added ${addedCount} New!`;
        setTimeout(() => { btn.innerHTML = origText; }, 2000);
      }
    }
  }

  /**
   * Inject Glassmorphic Floating Control Dock
   */
  function injectFloatingDock() {
    if (document.getElementById('scholarcite-dock')) return;

    const targetParent = document.getElementById('gs_res_ccl') || document.getElementById('gs_ccl') || document.getElementById('gs_ab') || document.body;

    const dock = document.createElement('div');
    dock.id = 'scholarcite-dock';
    dock.className = 'sc-dock-container';

    const cartCount = Object.keys(cartPapersMap).length;

    dock.innerHTML = `
      <div class="sc-dock-header">
        <div class="sc-dock-brand">
          <span class="sc-dock-logo">🎓 ScholarCite Express</span>
          <span id="sc-page-count-badge" class="sc-dock-count">(${getFilteredPagePapers().length} papers on page)</span>
        </div>
        <div class="sc-dock-header-right">
          <button id="sc-btn-view-cart" class="sc-btn sc-btn-cart" title="View & Export Accumulated Research Cart">
            🛒 Cart (<span id="sc-cart-count-badge">${cartCount}</span>)
          </button>
          <button id="sc-btn-clear-cart-dock" class="sc-dock-pill-toggle" title="Clear Accumulated Cart" style="color: #f87171;">
            🗑️ Clear Cart
          </button>
          <button id="sc-btn-help" class="sc-dock-pill-toggle" title="Open ScholarCite Express User Guide">
            ❓ User Guide
          </button>
        </div>
      </div>

      <div id="sc-dock-body" class="sc-dock-body">
        <div class="sc-dock-controls">
          <label class="sc-dock-field">
            <span>Style:</span>
            <select id="sc-style-select" class="sc-select">
              <option value="apa" ${activeStyle === 'apa' ? 'selected' : ''}>APA 7th</option>
              <option value="mla" ${activeStyle === 'mla' ? 'selected' : ''}>MLA 9th</option>
              <option value="chicago" ${activeStyle === 'chicago' ? 'selected' : ''}>Chicago 17th</option>
              <option value="ieee" ${activeStyle === 'ieee' ? 'selected' : ''}>IEEE</option>
              <option value="harvard" ${activeStyle === 'harvard' ? 'selected' : ''}>Harvard</option>
              <option value="bibtex" ${activeStyle === 'bibtex' ? 'selected' : ''}>BibTeX</option>
            </select>
          </label>

          <label class="sc-dock-field">
            <span>Limit:</span>
            <select id="sc-limit-select" class="sc-select">
              <option value="5" ${exportLimit === '5' ? 'selected' : ''}>5 Items</option>
              <option value="10" ${exportLimit === '10' ? 'selected' : ''}>10 Items</option>
              <option value="15" ${exportLimit === '15' ? 'selected' : ''}>15 Items</option>
              <option value="20" ${exportLimit === '20' ? 'selected' : ''}>20 Items</option>
              <option value="30" ${exportLimit === '30' ? 'selected' : ''}>30 Items</option>
              <option value="50" ${exportLimit === '50' ? 'selected' : ''}>50 Items</option>
              <option value="all" ${exportLimit === 'all' ? 'selected' : ''}>⚡ Max Available (All)</option>
            </select>
          </label>

          <label class="sc-dock-field sc-dock-checkbox" title="Auto-accumulate search results into Cart as you browse pages">
            <input type="checkbox" id="sc-auto-accumulate" ${autoAccumulate ? 'checked' : ''}>
            <span>Auto-Cart Pages</span>
          </label>

          <label class="sc-dock-field sc-dock-checkbox" title="Hide preprints like arXiv, SSRN, bioRxiv">
            <input type="checkbox" id="sc-exclude-preprints" ${excludePreprints ? 'checked' : ''}>
            <span>Exclude Preprints</span>
          </label>

          <label class="sc-dock-field sc-dock-checkbox" title="Hide items missing year, authors, or publication venue">
            <input type="checkbox" id="sc-exclude-incomplete" ${excludeIncomplete ? 'checked' : ''}>
            <span>Exclude Incomplete</span>
          </label>
        </div>

        <div class="sc-dock-buttons">
          <button id="sc-btn-add-page-cart" class="sc-btn sc-btn-cart-add" title="Add all visible papers from this page to Research Cart">
            ➕ Add Page to Cart
          </button>

          <button id="sc-btn-enrich-all" class="sc-btn sc-btn-enrich" title="Fetch Volume, Issue, Pages & Abstracts for papers (0 Google touch)">
            ⚡ Enrich Page
          </button>

          <button id="sc-btn-copy-all" class="sc-btn sc-btn-primary" title="Copy visible citations">
            📋 Copy Page
          </button>

          <button id="sc-btn-export-modal" class="sc-btn sc-btn-accent" title="Export as Word, Markdown (for LLM), JSON, BibTeX">
            📥 Export Page Dataset
          </button>
        </div>

        <div class="sc-dock-footer">
          Credits: <a href="https://www.linkedin.com/in/beingbabu/" target="_blank" rel="noopener noreferrer">Prof. Babu George</a>
        </div>
      </div>
    `;

    if (targetParent.firstChild) {
      targetParent.insertBefore(dock, targetParent.firstChild);
    } else {
      targetParent.appendChild(dock);
    }

    function addSafeListener(id, event, handler) {
      const el = document.getElementById(id);
      if (el) el.addEventListener(event, handler);
    }

    addSafeListener('sc-dock-toggle', 'click', function() {
      const isCollapsed = dock.classList.toggle('sc-dock-collapsed');
      const toggleIcon = document.getElementById('sc-dock-toggle-icon');
      if (toggleIcon) toggleIcon.innerText = isCollapsed ? '▼ Expand Controls' : '▲ Collapse';
    });

    addSafeListener('sc-style-select', 'change', function(e) {
      activeStyle = e.target.value;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteStyle: activeStyle });
      }
      updateAllCitations();
    });

    addSafeListener('sc-limit-select', 'change', function(e) {
      exportLimit = e.target.value;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteExportLimit: exportLimit });
      }
    });

    addSafeListener('sc-auto-accumulate', 'change', function(e) {
      autoAccumulate = e.target.checked;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteAutoAccumulate: autoAccumulate });
      }
      if (autoAccumulate) accumulateCurrentPageToCart(true);
    });

    addSafeListener('sc-exclude-preprints', 'change', function(e) {
      excludePreprints = e.target.checked;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteExcludePreprints: excludePreprints });
      }
      applyPaperFilters();
    });

    addSafeListener('sc-exclude-incomplete', 'change', function(e) {
      excludeIncomplete = e.target.checked;
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteExcludeIncomplete: excludeIncomplete });
      }
      applyPaperFilters();
    });

    addSafeListener('sc-btn-view-cart', 'click', () => {
      exportSourceMode = 'cart';
      openExportModal();
    });

    addSafeListener('sc-btn-clear-cart-dock', 'click', () => {
      cartPapersMap = {};
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteCart: {} });
      }
      updateCartUIState();
    });

    addSafeListener('sc-btn-help', 'click', () => {
      openHelpModal();
    });

    addSafeListener('sc-btn-add-page-cart', 'click', () => {
      accumulateCurrentPageToCart(true);
    });

    addSafeListener('sc-btn-enrich-all', 'click', handleEnrichAll);
    addSafeListener('sc-btn-copy-all', 'click', handleCopyAll);
    addSafeListener('sc-btn-export-modal', 'click', () => {
      exportSourceMode = 'page';
      openExportModal();
    });
  }

  /**
   * Inject User Guide Help Modal
   */
  function openHelpModal() {
    if (document.getElementById('scholarcite-help-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'scholarcite-help-modal';
    modal.className = 'sc-modal-overlay';

    modal.innerHTML = `
      <div class="sc-modal-content" style="max-width: 760px; max-height: 85vh; overflow-y: auto;">
        <div class="sc-modal-header">
          <h3>🎓 ScholarCite Express v1.2.0 - Complete User Guide</h3>
          <button id="sc-help-modal-close" class="sc-modal-close-btn">&times;</button>
        </div>

        <div class="sc-modal-body" style="display: flex; flex-direction: column; gap: 14px;">
          <div style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">🎓 1. Inline Citation Cards & Rank Badges (#1 - #10)</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Every Google Scholar result features an instant citation card in <strong>APA 7th, MLA 9th, Chicago 17th, IEEE, Harvard, or BibTeX</strong> format, equipped with position rank badges (<code>#1</code>, <code>#2</code>...) and publication type badges (<code>📰 JOURNAL</code>, <code>📚 BOOK</code>, <code>🏛️ CONFERENCE</code>, <code>📄 PREPRINT</code>).
            </p>
          </div>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">⚡ 2. Parallel Batch "Enrich Page" & 0% CAPTCHA Guarantee</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Click <strong>"⚡ Enrich Page"</strong> or <strong>"⚡ Enrich"</strong> on any paper card. Full metadata (Volume, Issue, Pages, DOI, and multi-paragraph abstracts) is fetched in <strong>parallel batches (3 at a time)</strong> from <strong>Crossref, Semantic Scholar, and OpenAlex Open APIs</strong> via an extension background service worker—ensuring <strong>zero automated requests to Google Scholar</strong> and 0% CAPTCHA risk.
            </p>
          </div>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">🔥 3. Visual Citation Impact & H-Index Benchmark Metrics</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Papers display visual impact badges (<code>🔥 Highly Cited (100+)</code>, <code>⭐ Influential (25+)</code>, <code>🌱 Emerging</code>). The Export Modal and Markdown export files automatically calculate <strong>Total Dataset Citations</strong>, <strong>Average Citations per Paper</strong>, and <strong>Dataset H-Index Benchmark</strong>.
            </p>
          </div>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">🏷️ 4. Research Keyword & Topic Tags</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Scans paper titles and abstracts to extract domain tags (e.g. <code>#Empirical</code>, <code>#DeepLearning</code>, <code>#Survey</code>, <code>#Framework</code>) for instant theme scanning.
            </p>
          </div>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">🛒 5. Multi-Page Research Cart Accumulator</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Check <strong>"Auto-Cart Pages"</strong> or click <strong>"➕ Add Page to Cart"</strong> to accumulate papers across multiple search queries and pages (Pages 1, 2, 3...). Topic query change auto-resets transient cart while preserving permanent bookmarks.
            </p>
          </div>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">⭐ 6. Persistent Bookmarks Manager & Popup</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Click the extension popup icon to access 4 tabs: <strong>⚙️ Settings</strong>, <strong>🛒 Cart</strong>, <strong>⭐ Bookmarks</strong>, and <strong>❓ Guide</strong>. The Bookmarks tab features topic filter dropdowns, multi-select checkboxes, bulk deletion (<code>🗑️ Delete Selected</code>), and exports.
            </p>
          </div>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">🤖 7. 7 Specialized Academic LLM Prompts (Including 👑 God-Mode)</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Copy pre-built academic prompts for Gemini, NotebookLM, ChatGPT, and Claude:
              <br>• 👑 <strong>God-Mode</strong>: Full 7-section publication manuscript generator
              <br>• 📋 <strong>Synthesis</strong> | 🔍 <strong>Gaps</strong> | 📊 <strong>Methodology</strong> | 💡 <strong>Theory</strong> | 🥊 <strong>Conflicts</strong> | ⚡ <strong>Implications</strong>
            </p>
          </div>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">📥 8. Multi-Format Exporters (Word, Markdown, JSON, BibTeX, RIS, PDF Links)</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Export dataset into <strong>Markdown (.md)</strong>, <strong>JSON</strong>, <strong>Word References (.docx)</strong>, <strong>Annotated Bibliography (.docx)</strong>, <strong>BibTeX (.bib)</strong>, <strong>RIS (.ris)</strong>, and <strong>Open Access PDF Links (.txt)</strong> for downloader tools.
            </p>
          </div>

          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 14px;">
            <h4 style="color: #38bdf8; font-size: 14.5px; font-weight: 700; margin-bottom: 6px;">🏷️ 9. COinS Metadata & Zotero Auto-Detect</h4>
            <p style="font-size: 12.5px; color: #cbd5e1; line-height: 1.5; margin: 0;">
              Embeds <strong>COinS OpenURL Z39.88</strong> metadata tags into every paper card, allowing Zotero Connector and Mendeley Web Importer to auto-detect citations automatically.
            </p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('sc-help-modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });
  }

  function extractKeywordBadges(title, abstract) {
    const text = `${title} ${abstract}`.toLowerCase();
    const keywords = [];

    if (text.includes('empirical') || text.includes('survey') || text.includes('experiment') || text.includes('case study') || text.includes('qualitative') || text.includes('quantitative') || text.includes('meta-analysis')) {
      if (text.includes('empirical')) keywords.push('#Empirical');
      else if (text.includes('meta-analysis')) keywords.push('#MetaAnalysis');
      else if (text.includes('case study')) keywords.push('#CaseStudy');
      else if (text.includes('survey')) keywords.push('#Survey');
    }

    if (text.includes('model') || text.includes('framework') || text.includes('architecture') || text.includes('algorithm') || text.includes('theory') || text.includes('paradigm')) {
      if (text.includes('framework')) keywords.push('#Framework');
      else if (text.includes('model')) keywords.push('#Model');
      else if (text.includes('algorithm')) keywords.push('#Algorithm');
    }

    if (text.includes('neural') || text.includes('deep learning') || text.includes('machine learning') || text.includes('artificial intelligence') || text.includes('transformer') || text.includes('llm') || text.includes('gpt')) {
      if (text.includes('deep learning')) keywords.push('#DeepLearning');
      else if (text.includes('machine learning')) keywords.push('#MachineLearning');
      else if (text.includes('ai') || text.includes('artificial intelligence')) keywords.push('#AI');
    }

    return keywords.slice(0, 2);
  }

  function getCitationImpactBadge(citeCount) {
    if (!citeCount || citeCount === 0) {
      return '<span class="sc-badge" style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid #475569;">🌱 Emerging</span>';
    } else if (citeCount >= 100) {
      return `<span class="sc-badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 800;">🔥 Highly Cited (${citeCount.toLocaleString()})</span>`;
    } else if (citeCount >= 25) {
      return `<span class="sc-badge" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); font-weight: 700;">⭐ Influential (${citeCount.toLocaleString()})</span>`;
    } else {
      return `<span class="sc-badge" style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3);">🌱 Cited (${citeCount})</span>`;
    }
  }

  /**
   * Inject Card under each paper result
   */
  function injectInlineCard(paper) {
    if (!paper || !paper.element) return;
    if (paper.element.querySelector('.scholarcite-inline-card')) return;

    const card = document.createElement('div');
    card.className = `scholarcite-inline-card sc-type-${paper.type} ${paper.isEnriched ? 'sc-card-enriched' : ''}`;
    card.setAttribute('data-paper-index', paper.index);
    card.setAttribute('data-paper-type', paper.type);

    const formattedCitation = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(paper, activeStyle) : '';
    const coinsTitle = window.ScholarCOinSGenerator ? window.ScholarCOinSGenerator.generateCOinS(paper) : '';
    const paperKey = getPaperKey(paper);
    const isSaved = !!savedPapersMap[paperKey];
    const isInCart = !!cartPapersMap[paperKey];

    const typeBadgeLabels = {
      journal: '📰 JOURNAL',
      book: '📚 BOOK',
      conference: '🏛️ CONFERENCE',
      preprint: '📄 PREPRINT',
      other: '🏷️ OTHER'
    };

    const typeBadgeText = typeBadgeLabels[paper.type] || '📰 JOURNAL';
    const kwBadges = extractKeywordBadges(paper.title, paper.abstract || paper.snippet || '');
    const kwHTML = kwBadges.map(kw => `<span class="sc-badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3);">${kw}</span>`).join('');
    const impactHTML = getCitationImpactBadge(paper.citeCount);

    card.innerHTML = `
      <!-- COinS Metadata Tag for Zotero/Mendeley Auto-Detect -->
      <span class="Z3988" title="${escapeHTML(coinsTitle)}"></span>

      <div class="sc-card-header">
        <div class="sc-card-badges">
          <span class="sc-badge sc-badge-rank" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); font-weight: 800;">#${paper.index}</span>
          <span class="sc-type-badge sc-badge-${paper.type}">${typeBadgeText}</span>
          ${impactHTML}
          ${kwHTML}
          <span class="sc-badge sc-badge-enrichment ${paper.isEnriched ? 'sc-badge-enriched' : ''}">
            ${paper.isEnriched ? `✓ ENRICHED ${paper.volume ? `(Vol ${paper.volume}${paper.pages ? `, pp. ${paper.pages}` : ''})` : ''}` : `${activeStyle.toUpperCase()}`}
          </span>
        </div>

        <div class="sc-card-actions">
          <button class="sc-card-btn sc-btn-abstract" title="Read Full Abstract">
            📖 Abstract
          </button>
          <button class="sc-card-btn sc-btn-enrich-single" title="Fetch Volume, Issue, Pages via Open APIs">
            ${paper.isEnriched ? '✓ Enriched' : '⚡ Enrich'}
          </button>
          ${paper.openAccessPdf ? `
            <a href="${paper.openAccessPdf}" target="_blank" class="sc-card-btn sc-btn-oa" title="Open Legal PDF">
              🔓 Open Access PDF
            </a>
          ` : ''}
          ${paper.doi ? `
            <a href="https://doi.org/${paper.doi}" target="_blank" class="sc-card-btn" title="Open Official Publisher DOI Host" style="background: #1e293b; color: #38bdf8; border: 1px solid #334155;">
              🌐 DOI.org
            </a>
          ` : ''}
          <button class="sc-card-btn sc-btn-cart-toggle ${isInCart ? 'sc-cart-active' : ''}" title="Add/Remove from Research Cart">
            ${isInCart ? '✓ In Cart' : '🛒 +Cart'}
          </button>
          <button class="sc-card-btn sc-btn-save ${isSaved ? 'sc-saved' : ''}" title="Save to Bookmark List">
            ${isSaved ? '⭐ Saved' : '☆ Bookmark'}
          </button>
          <button class="sc-card-btn sc-btn-copy-bibtex" title="Copy BibTeX Citation to Clipboard">
            🏷️ BibTeX
          </button>
          <button class="sc-card-btn sc-btn-copy" title="Copy active style citation to clipboard">
            📋 Copy
          </button>
        </div>
      </div>

      <div class="sc-citation-text">${escapeHTML(formattedCitation)}</div>

      <!-- Expandable Abstract Drawer -->
      <div class="sc-abstract-drawer" style="display: none;">
        <div class="sc-abstract-content">
          <div class="sc-abstract-header">
            <strong>Full Abstract:</strong>
            <button class="sc-card-btn sc-btn-copy-abs" title="Copy Citation + Abstract for research notes">
              📋 Copy Citation + Abstract
            </button>
          </div>
          <p class="sc-abstract-body">${paper.abstract ? escapeHTML(paper.abstract) : '<em>Click "📖 Abstract" to fetch full text from Open APIs...</em>'}</p>
        </div>
      </div>
    `;

    const appendTarget = paper.element.querySelector('.gs_ri') || paper.element;
    appendTarget.appendChild(card);

    // Event Handlers
    const copyBibBtn = card.querySelector('.sc-btn-copy-bibtex');
    if (copyBibBtn) {
      copyBibBtn.addEventListener('click', function() {
        const bib = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(paper, 'bibtex') : paper.title;
        navigator.clipboard.writeText(bib).then(() => {
          copyBibBtn.innerText = '✓ Copied!';
          setTimeout(() => { copyBibBtn.innerText = '🏷️ BibTeX'; }, 1500);
        });
      });
    }

    // Event Handlers
    const absBtn = card.querySelector('.sc-btn-abstract');
    const drawer = card.querySelector('.sc-abstract-drawer');

    absBtn.addEventListener('click', async function() {
      if (drawer.style.display === 'none') {
        drawer.style.display = 'block';
        absBtn.classList.add('sc-active-tab');

        if (!paper.hasFullAbstract && window.ScholarAbstractFetcher) {
          const absBody = card.querySelector('.sc-abstract-body');
          absBody.innerHTML = '<em>Fetching full abstract from Semantic Scholar & OpenAlex APIs...</em>';
          await window.ScholarAbstractFetcher.fetchAbstract(paper);
          absBody.innerText = paper.abstract || 'No full abstract found.';
          updateCardUI(paper);
        }
      } else {
        drawer.style.display = 'none';
        absBtn.classList.remove('sc-active-tab');
      }
    });

    const copyAbsBtn = card.querySelector('.sc-btn-copy-abs');
    copyAbsBtn.addEventListener('click', function() {
      const currentCit = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(paper, activeStyle) : paper.title;
      const formattedNote = `## ${paper.title}\n\n**Citation (${activeStyle.toUpperCase()})**:\n${currentCit}\n\n**Abstract**:\n${paper.abstract || paper.snippet || ''}`;
      navigator.clipboard.writeText(formattedNote).then(() => {
        copyAbsBtn.innerText = '✓ Note Copied!';
        setTimeout(() => { copyAbsBtn.innerText = '📋 Copy Citation + Abstract'; }, 2000);
      });
    });

    const enrichBtn = card.querySelector('.sc-btn-enrich-single');
    enrichBtn.addEventListener('click', async function() {
      enrichBtn.innerText = '⌛ Fetching...';
      enrichBtn.disabled = true;
      if (window.ScholarEnricher) {
        await window.ScholarEnricher.enrichPaper(paper);
      }
      if (window.ScholarAbstractFetcher && !paper.hasFullAbstract) {
        await window.ScholarAbstractFetcher.fetchAbstract(paper);
      }
      updateCardUI(paper);
    });

    const cartToggleBtn = card.querySelector('.sc-btn-cart-toggle');
    cartToggleBtn.addEventListener('click', function() {
      const key = getPaperKey(paper);
      if (cartPapersMap[key]) {
        delete cartPapersMap[key];
      } else {
        cartPapersMap[key] = paper;
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteCart: cartPapersMap });
      }
      updateCardUI(paper);
      updateCartUIState();
    });

    const saveBtn = card.querySelector('.sc-btn-save');
    saveBtn.addEventListener('click', function() {
      const key = getPaperKey(paper);
      if (savedPapersMap[key]) {
        delete savedPapersMap[key];
      } else {
        const queryTopic = getCurrentSearchQuery() || 'General Research';
        savedPapersMap[key] = Object.assign({}, paper, { searchTopic: queryTopic });
      }
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteSaved: savedPapersMap });
      }
      updateCardUI(paper);
    });

    const copyBtn = card.querySelector('.sc-btn-copy');
    copyBtn.addEventListener('click', function() {
      const currentText = window.ScholarCitationFormatter.format(paper, activeStyle);
      navigator.clipboard.writeText(currentText).then(() => {
        copyBtn.innerText = '✓ Copied!';
        copyBtn.classList.add('sc-copied');
        setTimeout(() => {
          copyBtn.innerText = '📋 Copy';
          copyBtn.classList.remove('sc-copied');
        }, 2000);
      });
    });
  }

  function updateCardUI(paper) {
    if (!paper || !paper.element) return;
    const card = paper.element.querySelector('.scholarcite-inline-card');
    if (!card) return;

    if (paper.isEnriched) card.classList.add('sc-card-enriched');

    const badge = card.querySelector('.sc-badge-enrichment');
    if (badge) {
      badge.className = `sc-badge sc-badge-enrichment ${paper.isEnriched ? 'sc-badge-enriched' : ''}`;
      badge.innerText = paper.isEnriched 
        ? `✓ ENRICHED ${paper.volume ? `(Vol ${paper.volume}${paper.pages ? `, pp. ${paper.pages}` : ''})` : ''}`
        : `${activeStyle.toUpperCase()}`;
    }

    const enrichBtn = card.querySelector('.sc-btn-enrich-single');
    if (enrichBtn) {
      enrichBtn.innerText = paper.isEnriched ? '✓ Enriched' : '⚡ Enrich';
      enrichBtn.disabled = paper.isEnriched;
    }

    const paperKey = getPaperKey(paper);

    const isInCart = !!cartPapersMap[paperKey];
    const cartToggleBtn = card.querySelector('.sc-btn-cart-toggle');
    if (cartToggleBtn) {
      cartToggleBtn.innerText = isInCart ? '✓ In Cart' : '🛒 +Cart';
      if (isInCart) cartToggleBtn.classList.add('sc-cart-active'); else cartToggleBtn.classList.remove('sc-cart-active');
    }

    const isSaved = !!savedPapersMap[paperKey];
    const saveBtn = card.querySelector('.sc-btn-save');
    if (saveBtn) {
      saveBtn.innerText = isSaved ? '⭐ Saved' : '☆ Bookmark';
      if (isSaved) saveBtn.classList.add('sc-saved'); else saveBtn.classList.remove('sc-saved');
    }

    const textEl = card.querySelector('.sc-citation-text');
    if (textEl && window.ScholarCitationFormatter) {
      textEl.innerHTML = escapeHTML(window.ScholarCitationFormatter.format(paper, activeStyle));
    }

    const absBody = card.querySelector('.sc-abstract-body');
    if (absBody && paper.abstract) {
      absBody.innerText = paper.abstract;
    }

    const coinsSpan = card.querySelector('.Z3988');
    if (coinsSpan && window.ScholarCOinSGenerator) {
      coinsSpan.setAttribute('title', window.ScholarCOinSGenerator.generateCOinS(paper));
    }

    // Dynamic Open Access PDF badge insertion
    if (paper.openAccessPdf) {
      let oaLink = card.querySelector('.sc-btn-oa');
      if (oaLink) {
        oaLink.href = paper.openAccessPdf;
      } else {
        const actionsContainer = card.querySelector('.sc-card-actions');
        if (actionsContainer) {
          const newOaBtn = document.createElement('a');
          newOaBtn.href = paper.openAccessPdf;
          newOaBtn.target = '_blank';
          newOaBtn.className = 'sc-card-btn sc-btn-oa';
          newOaBtn.title = 'Open Legal PDF';
          newOaBtn.innerText = '🔓 Open Access PDF';
          const saveBtnRef = actionsContainer.querySelector('.sc-btn-save');
          if (saveBtnRef) {
            actionsContainer.insertBefore(newOaBtn, saveBtnRef);
          } else {
            actionsContainer.appendChild(newOaBtn);
          }
        }
      }
    }

    // Sync in-memory Cart and Saved Bookmarks
    if (cartPapersMap[paperKey]) {
      cartPapersMap[paperKey] = Object.assign({}, cartPapersMap[paperKey], paper);
    }
    if (savedPapersMap[paperKey]) {
      savedPapersMap[paperKey] = Object.assign({}, savedPapersMap[paperKey], paper);
    }
  }

  function updateCartUIState() {
    const badge = document.getElementById('sc-cart-count-badge');
    if (badge) {
      badge.innerText = Object.keys(cartPapersMap).length;
    }
    parsedPapers.forEach(p => updateCardUI(p));
  }

  function applyPaperFilters() {
    parsedPapers.forEach(paper => {
      if (!paper.element) return;
      let shouldShow = true;

      if (excludePreprints && paper.type === 'preprint') {
        shouldShow = false;
      }

      if (excludeIncomplete) {
        if (!paper.title || paper.title.trim().length === 0) {
          shouldShow = false;
        }
      }

      paper.element.style.display = shouldShow ? '' : 'none';
      const card = paper.element.querySelector('.scholarcite-inline-card');
      if (card) card.style.display = shouldShow ? '' : 'none';
    });

    const pageCountBadge = document.getElementById('sc-page-count-badge');
    if (pageCountBadge) {
      pageCountBadge.innerText = `(${getFilteredPagePapers().length} papers on page)`;
    }

    // Purge excluded items from Research Cart if filters are active
    if (excludePreprints || excludeIncomplete) {
      let cartChanged = false;
      Object.keys(cartPapersMap).forEach(key => {
        const p = cartPapersMap[key];
        let remove = false;
        if (excludePreprints && p.type === 'preprint') remove = true;
        if (excludeIncomplete && (!p.title || p.title.trim().length === 0)) remove = true;
        if (remove) {
          delete cartPapersMap[key];
          cartChanged = true;
        }
      });
      if (cartChanged && typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteCart: cartPapersMap });
      }
      updateCartUIState();
    }
  }

  function getFilteredPagePapers() {
    let papers = parsedPapers;

    if (excludePreprints) {
      papers = papers.filter(p => p.type !== 'preprint');
    }

    if (excludeIncomplete) {
      papers = papers.filter(p => p.title && p.title.trim().length > 0);
    }

    return papers;
  }

  function getExportDataset() {
    let papers = [];

    if (exportSourceMode === 'cart') {
      papers = Object.values(cartPapersMap);
    } else {
      papers = getFilteredPagePapers();
    }

    if (excludePreprints) {
      papers = papers.filter(p => p.type !== 'preprint');
    }

    if (excludeIncomplete) {
      papers = papers.filter(p => p.title && p.title.trim().length > 0);
    }

    if (exportLimit !== 'all') {
      const limitNum = parseInt(exportLimit, 10);
      if (!isNaN(limitNum) && limitNum > 0) {
        papers = papers.slice(0, limitNum);
      }
    }

    return papers;
  }

  async function handleEnrichAll() {
    const btn = document.getElementById('sc-btn-enrich-all');
    if (!btn) return;
    const originalText = btn.innerHTML;
    btn.disabled = true;

    const visible = getFilteredPagePapers();
    const total = visible.length;
    let completed = 0;

    btn.innerText = `⚡ Enriching Page (0/${total})...`;

    const chunkSize = 3;
    for (let i = 0; i < visible.length; i += chunkSize) {
      const chunk = visible.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (paper) => {
        try {
          if (window.ScholarEnricher) {
            await window.ScholarEnricher.enrichPaper(paper);
          }
          if (window.ScholarAbstractFetcher && !paper.hasFullAbstract) {
            await window.ScholarAbstractFetcher.fetchAbstract(paper);
          }
          updateCardUI(paper);
        } catch (err) {
          // Fall through quietly
        } finally {
          completed++;
          btn.innerText = `⚡ Enriching Page (${completed}/${total})...`;
        }
      }));
      await new Promise(r => setTimeout(r, 150));
    }

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ 
        scholarCiteCart: cartPapersMap,
        scholarCiteSaved: savedPapersMap 
      });
    }

    btn.innerText = `✓ All ${total} Papers Enriched!`;
    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 3000);
  }

  function handleCopyAll() {
    const dataset = getExportDataset();
    const allFormatted = dataset.map(p => 
      window.ScholarCitationFormatter.format(p, activeStyle)
    ).join('\n\n');

    navigator.clipboard.writeText(allFormatted).then(() => {
      const btn = document.getElementById('sc-btn-copy-all');
      if (btn) {
        const orig = btn.innerHTML;
        btn.innerHTML = '✓ Copied Dataset!';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
      }
    });
  }

  /**
   * Modal Overlay for Multi-Format Exports + LLM Prompt Presets
   */
  function openExportModal() {
    if (document.getElementById('sc-export-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'sc-export-modal';
    modal.className = 'sc-modal-overlay';

    const cartCount = Object.keys(cartPapersMap).length;
    const exportPapers = getExportDataset();
    const searchInput = document.querySelector('input[name="q"]');
    const query = searchInput ? searchInput.value : '';

    modal.innerHTML = `
      <div class="sc-modal-content">
        <div class="sc-modal-header">
          <h3>📥 Export Research Dataset (${exportPapers.length} Papers)</h3>
          <button id="sc-modal-close" class="sc-modal-close-btn">&times;</button>
        </div>

        <div class="sc-modal-body">
          <div class="sc-source-toggle-bar" style="display: flex; gap: 8px; margin-bottom: 14px;">
            <button id="sc-src-cart" class="sc-src-btn ${exportSourceMode === 'cart' ? 'active' : ''}" style="flex:1; padding: 8px; font-weight:700; border-radius:8px; border:1px solid #38bdf8; background:${exportSourceMode === 'cart' ? '#0284c7' : '#1e293b'}; color:#fff; cursor:pointer;">
              🛒 Research Cart (${cartCount} Total)
            </button>
            <button id="sc-src-page" class="sc-src-btn ${exportSourceMode === 'page' ? 'active' : ''}" style="flex:1; padding: 8px; font-weight:700; border-radius:8px; border:1px solid #334155; background:${exportSourceMode === 'page' ? '#0284c7' : '#1e293b'}; color:#fff; cursor:pointer;">
              📄 Current Page (${getFilteredPagePapers().length})
            </button>
          </div>

          <p class="sc-modal-desc">
            Source: <strong>${exportSourceMode === 'cart' ? 'ACCUMULATED RESEARCH CART' : 'CURRENT SEARCH PAGE'}</strong> | 
            Style: <strong>${activeStyle.toUpperCase()}</strong> | 
            Limit: <strong>${exportLimit.toUpperCase()}</strong> 
            ${excludePreprints ? ' | <strong style="color: #ef4444;">🚫 Preprints Excluded</strong>' : ''}
            ${excludeIncomplete ? ' | <strong style="color: #f59e0b;">⚠️ Incomplete Citations Excluded</strong>' : ''}
          </p>

          ${(function() {
            const metrics = window.ScholarExportEngine ? window.ScholarExportEngine.calculateMetrics(exportPapers) : { totalCitations: 0, avgCitations: 0, hIndex: 0, highlyCitedCount: 0 };
            return `
              <div class="sc-metrics-banner" style="background: rgba(30, 41, 59, 0.8); border: 1px solid #334155; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-around; font-size: 12px; color: #cbd5e1; flex-wrap: wrap; gap: 8px;">
                <div>🔥 Total Citations: <strong style="color:#38bdf8;">${metrics.totalCitations.toLocaleString()}</strong></div>
                <div>📊 Avg / Paper: <strong style="color:#38bdf8;">${metrics.avgCitations.toLocaleString()}</strong></div>
                <div>📈 H-Index Benchmark: <strong style="color:#38bdf8;">${metrics.hIndex}</strong></div>
                <div>⭐ Highly Cited: <strong style="color:#38bdf8;">${metrics.highlyCitedCount}</strong></div>
              </div>
            `;
          })()}

          <div class="sc-export-section">
            <h4>🤖 AI & LLM Formats (Gemini, NotebookLM, ChatGPT, Claude)</h4>
            <div class="sc-export-grid">
              <button id="sc-exp-md" class="sc-exp-btn sc-exp-llm">
                <span class="sc-exp-title">📝 Markdown (.md)</span>
                <span class="sc-exp-sub">Best for LLM Prompts & NotebookLM</span>
              </button>
              <button id="sc-exp-json" class="sc-exp-btn sc-exp-llm">
                <span class="sc-exp-title">📊 JSON (.json)</span>
                <span class="sc-exp-sub">Best for RAG & AI Agents</span>
              </button>
            </div>

            <div class="sc-prompts-box">
              <span class="sc-prompts-title">Copy Academic LLM Prompts (Gemini, NotebookLM, ChatGPT, Claude):</span>
              <div class="sc-prompts-btns">
                <button id="sc-prompt-god" class="sc-prompt-btn sc-prompt-btn-god">👑 God-Mode: Draft Full Academic Paper</button>
                <button id="sc-prompt-synth" class="sc-prompt-btn">📋 Synthesis</button>
                <button id="sc-prompt-gaps" class="sc-prompt-btn">🔍 Research Gaps</button>
                <button id="sc-prompt-method" class="sc-prompt-btn">📊 Methodology</button>
                <button id="sc-prompt-theory" class="sc-prompt-btn">💡 Theory & Frameworks</button>
                <button id="sc-prompt-conflicts" class="sc-prompt-btn">🥊 Conflicting Findings</button>
                <button id="sc-prompt-implications" class="sc-prompt-btn">⚡ Practical Implications</button>
              </div>
            </div>
          </div>

          <div class="sc-export-section">
            <h4>📄 Academic Word Documents</h4>
            <div class="sc-export-grid">
              <button id="sc-exp-docx-ref" class="sc-exp-btn">
                <span class="sc-exp-title">📄 Word References (.docx)</span>
                <span class="sc-exp-sub">Clean Academic References</span>
              </button>
              <button id="sc-exp-docx-ann" class="sc-exp-btn">
                <span class="sc-exp-title">📑 Annotated Bibliography (.docx)</span>
                <span class="sc-exp-sub">Includes Formatted Abstracts</span>
              </button>
            </div>
          </div>

          <div class="sc-export-section">
            <h4>🏷️ Reference Managers & PDF Downloader Tools</h4>
            <div class="sc-export-grid">
              <button id="sc-exp-bib" class="sc-exp-btn">
                <span class="sc-exp-title">🏷️ BibTeX (.bib)</span>
                <span class="sc-exp-sub">LaTeX & Citation Format</span>
              </button>
              <button id="sc-exp-ris" class="sc-exp-btn">
                <span class="sc-exp-title">📦 RIS (.ris)</span>
                <span class="sc-exp-sub">EndNote & RefMan Format</span>
              </button>
              <button id="sc-exp-pdf-links" class="sc-exp-btn" style="border-color: #0284c7;">
                <span class="sc-exp-title">📥 Open Access PDF Links (.txt)</span>
                <span class="sc-exp-sub">Batch URLs for Downloader Tools</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('sc-modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    document.getElementById('sc-src-cart').addEventListener('click', () => {
      exportSourceMode = 'cart';
      document.body.removeChild(modal);
      openExportModal();
    });

    document.getElementById('sc-src-page').addEventListener('click', () => {
      exportSourceMode = 'page';
      document.body.removeChild(modal);
      openExportModal();
    });

    document.getElementById('sc-exp-md').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportData(exportPapers, 'markdown', activeStyle, query || 'Research_Dataset');
    });

    document.getElementById('sc-exp-json').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportData(exportPapers, 'json', activeStyle, query || 'Research_Dataset');
    });

    document.getElementById('sc-exp-docx-ref').addEventListener('click', () => {
      if (window.ScholarDocxGenerator) window.ScholarDocxGenerator.downloadWordDocument(exportPapers, activeStyle, query || 'Research Dataset', false);
    });

    document.getElementById('sc-exp-docx-ann').addEventListener('click', () => {
      if (window.ScholarDocxGenerator) window.ScholarDocxGenerator.downloadWordDocument(exportPapers, activeStyle, query || 'Research Dataset', true);
    });

    document.getElementById('sc-exp-bib').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportData(exportPapers, 'bibtex', activeStyle, query || 'Research_Dataset');
    });

    document.getElementById('sc-exp-ris').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportData(exportPapers, 'ris', activeStyle, query || 'Research_Dataset');
    });

    document.getElementById('sc-exp-pdf-links').addEventListener('click', () => {
      if (window.ScholarExportEngine) window.ScholarExportEngine.exportPDFLinks(exportPapers, query || 'Research_Dataset');
    });

    function attachPromptCopy(btnId, promptKey) {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const prompts = window.ScholarExportEngine ? window.ScholarExportEngine.getLLMPrompts() : {};
        const textToCopy = prompts[promptKey] || '';
        navigator.clipboard.writeText(textToCopy).then(() => {
          const orig = btn.innerText;
          btn.innerText = '✓ Prompt Copied!';
          const origBg = btn.style.background;
          btn.style.background = '#059669';
          setTimeout(() => {
            btn.innerText = orig;
            btn.style.background = origBg;
          }, 2000);
        });
      });
    }

    attachPromptCopy('sc-prompt-god', 'godmode');
    attachPromptCopy('sc-prompt-synth', 'synthesis');
    attachPromptCopy('sc-prompt-gaps', 'gaps');
    attachPromptCopy('sc-prompt-method', 'methodology');
    attachPromptCopy('sc-prompt-theory', 'theory');
    attachPromptCopy('sc-prompt-conflicts', 'conflicts');
    attachPromptCopy('sc-prompt-implications', 'implications');
  }

  function updateAllCitations() {
    parsedPapers.forEach(p => updateCardUI(p));
  }

  function updateAllSaveButtons() {
    parsedPapers.forEach(p => updateCardUI(p));
  }

  function updateToolbarSelectState() {
    const styleSelect = document.getElementById('sc-style-select');
    if (styleSelect) styleSelect.value = activeStyle;

    const limitSelect = document.getElementById('sc-limit-select');
    if (limitSelect) limitSelect.value = exportLimit;

    const autoAccCheckbox = document.getElementById('sc-auto-accumulate');
    if (autoAccCheckbox) autoAccCheckbox.checked = autoAccumulate;

    const preprintsCheckbox = document.getElementById('sc-exclude-preprints');
    if (preprintsCheckbox) preprintsCheckbox.checked = excludePreprints;

    const incompleteCheckbox = document.getElementById('sc-exclude-incomplete');
    if (incompleteCheckbox) incompleteCheckbox.checked = excludeIncomplete;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
