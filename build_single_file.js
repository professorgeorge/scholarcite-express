const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, 'app.css'), 'utf8');
const citFormatter = fs.readFileSync(path.join(__dirname, 'lib/citationFormatter.js'), 'utf8');
const docxGen = fs.readFileSync(path.join(__dirname, 'lib/docxGenerator.js'), 'utf8');
const expEngine = fs.readFileSync(path.join(__dirname, 'lib/exportEngine.js'), 'utf8');
const coinsGen = fs.readFileSync(path.join(__dirname, 'lib/coinsGenerator.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');

const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ScholarCite Express - Smart Academic Research Suite &amp; Live Citation Generator</title>
  <meta name="description" content="Free academic research suite and live citation generator. Format APA 7th, MLA 9th, Chicago, IEEE, Harvard, and BibTeX citations, export Word and Markdown datasets with H-Index metrics, and generate LLM literature review prompts.">
  <meta name="keywords" content="Google Scholar, citation generator, APA 7th, MLA 9th, BibTeX, LLM literature review, research cart, academic research tool, Babu George">
  
  <!-- Open Graph -->
  <meta property="og:title" content="ScholarCite Express - Smart Academic Research Suite">
  <meta property="og:description" content="Generate instant citations, fetch multi-paragraph abstracts, calculate H-index benchmarks, and export Word/Markdown datasets for LLMs.">
  <meta property="og:type" content="website">
  
  <style>
${css}
  </style>
</head>
<body>

  <!-- Navigation -->
  <header class="site-nav">
    <div class="nav-container">
      <a href="#" class="nav-brand">
        <span class="nav-logo-icon">🎓</span>
        <span class="nav-brand-text">ScholarCite Express</span>
        <span class="nav-badge-pill">v1.2.0 Web</span>
      </a>

      <ul class="nav-links">
        <li><a href="#app">Search &amp; Cite</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#compare">Comparison</a></li>
        <li><a href="#install">Install Extension</a></li>
        <li><a href="#privacy">Privacy</a></li>
      </ul>

      <div style="display: flex; align-items: center; gap: 10px;">
        <button id="btn-nav-cart" class="nav-btn-cart" title="View Accumulated Research Cart">
          🛒 Cart (<span id="nav-cart-count" class="cart-counter">0</span>)
        </button>
        <a href="https://github.com/professorgeorge/scholarcite-express" target="_blank" rel="noopener noreferrer" class="nav-btn-download" title="Open GitHub Repository">
          ⭐ GitHub
        </a>
      </div>
    </div>
  </header>

  <div class="main-wrapper">
    
    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-pill-badge">
        <span>✨ 100% Free &bull; Zero CAPTCHA &bull; 0 Google Touch Guarantee</span>
      </div>

      <h1 class="hero-title">
        The Modern Academic Citation Suite &amp; <span class="hero-gradient-text">LLM Research Exporter</span>
      </h1>

      <p class="hero-subtitle">
        Search millions of open academic papers, format publication-ready citations across 6 styles, calculate dataset H-Index benchmarks, and generate structured literature review datasets for Gemini, NotebookLM, ChatGPT &amp; Claude.
      </p>

      <div class="hero-actions-row">
        <a href="#app" class="hero-btn-primary">
          🔍 Try Live Search &amp; Cite Tool
        </a>
        <a href="#" id="btn-install-guide" class="hero-btn-secondary">
          🧩 Chrome Extension Guide (30s)
        </a>
      </div>

      <!-- Feature Highlight Badges -->
      <div id="features" class="hero-features-strip">
        <div class="hero-feature-item">
          <span class="hero-feature-icon">⚡</span>
          <div class="hero-feature-text">
            <h4>6 Citation Formats</h4>
            <p>APA 7th, MLA 9th, Chicago, IEEE, Harvard, and BibTeX</p>
          </div>
        </div>

        <div class="hero-feature-item">
          <span class="hero-feature-icon">👑</span>
          <div class="hero-feature-text">
            <h4>God-Mode Prompts</h4>
            <p>7-section publication manuscript generator for LLMs</p>
          </div>
        </div>

        <div class="hero-feature-item">
          <span class="hero-feature-icon">🛒</span>
          <div class="hero-feature-text">
            <h4>Research Cart</h4>
            <p>Accumulate papers across multiple queries &amp; topics</p>
          </div>
        </div>

        <div class="hero-feature-item">
          <span class="hero-feature-icon">📊</span>
          <div class="hero-feature-text">
            <h4>H-Index Metrics</h4>
            <p>Instant dataset impact &amp; average citation calculation</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Search & Citation App -->
    <section id="app" class="app-section">
      <div class="app-header">
        <div class="app-title-group">
          <h2>🔍 Live Academic Search &amp; Citation Engine</h2>
          <p>Direct live queries to OpenAlex &amp; Crossref open academic repositories &bull; 0 backend servers</p>
        </div>

        <div class="app-controls-top">
          <span id="results-count-label" style="font-size: 13px; font-weight: 700; color: #38bdf8;">(Loading...)</span>
        </div>
      </div>

      <!-- Search Input Box -->
      <div class="search-container">
        <form id="web-search-form" class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="web-search-input" class="search-input" placeholder="Search any research topic, paper title, or DOI (e.g. 10.1038/s41586-020-2649-2)..." autocomplete="off">
          <button type="submit" class="search-btn">Search Papers</button>
        </form>

        <div class="quick-topics">
          <span class="quick-topics-label">Try Topics:</span>
          <span class="topic-pill" data-topic="Generative AI in Higher Education">🤖 Generative AI in Higher Ed</span>
          <span class="topic-pill" data-topic="Deep Residual Learning for Image Recognition">🧠 Deep Residual Learning</span>
          <span class="topic-pill" data-topic="Supply Chain Resilience">📦 Supply Chain Resilience</span>
          <span class="topic-pill" data-topic="Quantum Computing Algorithms">⚛️ Quantum Algorithms</span>
          <span class="topic-pill" data-topic="Climate Change Mitigation Strategies">🌍 Climate Mitigation</span>
        </div>
      </div>

      <!-- Filter & Style Bar -->
      <div class="filter-bar">
        <div class="style-selector-group">
          <span>Style:</span>
          <button class="style-btn active" data-style="apa">APA 7th</button>
          <button class="style-btn" data-style="mla">MLA 9th</button>
          <button class="style-btn" data-style="chicago">Chicago 17th</button>
          <button class="style-btn" data-style="ieee">IEEE</button>
          <button class="style-btn" data-style="harvard">Harvard</button>
          <button class="style-btn" data-style="bibtex">BibTeX</button>
        </div>

        <div class="filter-checkboxes">
          <label class="custom-checkbox">
            <input type="checkbox" id="chk-exclude-preprints">
            <span>Exclude Preprints</span>
          </label>
          <label class="custom-checkbox">
            <input type="checkbox" id="chk-exclude-incomplete">
            <span>Exclude Incomplete</span>
          </label>
        </div>
      </div>

      <!-- Live Dataset Metrics Banner -->
      <div class="metrics-banner">
        <div class="metric-card">
          <div id="metric-total-cites" class="metric-value">0</div>
          <div class="metric-label">Total Citations</div>
        </div>
        <div class="metric-card">
          <div id="metric-avg-cites" class="metric-value">0</div>
          <div class="metric-label">Avg Citations / Paper</div>
        </div>
        <div class="metric-card">
          <div id="metric-h-index" class="metric-value">0</div>
          <div class="metric-label">Dataset H-Index</div>
        </div>
        <div class="metric-card">
          <div id="metric-high-count" class="metric-value">0</div>
          <div class="metric-label">Highly Cited (100+)</div>
        </div>
      </div>

      <!-- Action Buttons Bar -->
      <div class="action-buttons-bar">
        <div class="action-btns-left">
          <button id="btn-copy-all" class="act-btn act-btn-primary">
            📋 Copy Citations
          </button>
          <button id="btn-add-all-cart" class="act-btn">
            ➕ Add Page to Cart
          </button>
          <button id="btn-god-mode-top" class="act-btn act-btn-god">
            👑 God-Mode Prompt
          </button>
        </div>

        <button id="btn-open-export-modal" class="act-btn act-btn-primary">
          📥 Export Dataset (.docx, .md, .json)
        </button>
      </div>

      <!-- Results Grid Container -->
      <div id="results-container" class="results-list">
        <!-- Dynamically rendered via JS -->
      </div>
    </section>

    <!-- Comparison Section -->
    <section id="compare" class="showcase-section">
      <div class="section-title">
        <h2>Why Scholars Choose ScholarCite Express</h2>
        <p>Built specifically for modern researchers who need fast citations, clean Word exports, and AI/LLM readiness.</p>
      </div>

      <div class="comparison-table-wrap">
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Feature Capability</th>
              <th style="color: #38bdf8;">ScholarCite Express</th>
              <th>Zotero Connector</th>
              <th>Mendeley Importer</th>
              <th>Native Google Scholar</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Inline Citation Badges</strong></td>
              <td class="highlight">✓ Instant Overlay (#1 - #20)</td>
              <td>❌ Requires external app</td>
              <td>❌ Requires external app</td>
              <td>❌ Single popup only</td>
            </tr>
            <tr>
              <td><strong>Multi-Page Research Cart Accumulator</strong></td>
              <td class="highlight">✓ Auto-Accumulate across queries</td>
              <td>❌ Manual folder sorting</td>
              <td>❌ Manual folder sorting</td>
              <td>❌ No Cart</td>
            </tr>
            <tr>
              <td><strong>AI / LLM Prompts (Gemini, NotebookLM, GPT)</strong></td>
              <td class="highlight">✓ 👑 God-Mode + 6 Presets</td>
              <td>❌ No LLM integration</td>
              <td>❌ No LLM integration</td>
              <td>❌ No LLM integration</td>
            </tr>
            <tr>
              <td><strong>Dataset H-Index &amp; Citation Metrics</strong></td>
              <td class="highlight">✓ Automatic calculation</td>
              <td>❌ Not available</td>
              <td>❌ Not available</td>
              <td>❌ Per-author profile only</td>
            </tr>
            <tr>
              <td><strong>Microsoft Word References (.docx)</strong></td>
              <td class="highlight">✓ Direct 1-Click Download</td>
              <td>❌ Word plugin required</td>
              <td>❌ Word plugin required</td>
              <td>❌ Copy text only</td>
            </tr>
            <tr>
              <td><strong>0% CAPTCHA &amp; 0 Google Touch Risk</strong></td>
              <td class="highlight">✓ 100% Open Academic APIs</td>
              <td>⚠️ May trigger rate limits</td>
              <td>⚠️ May trigger rate limits</td>
              <td>⚠️ Strict CAPTCHA gates</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- Chrome Extension Installation Guide -->
    <section id="install" class="showcase-section">
      <div class="section-title">
        <h2>Add to Google Chrome in 30 Seconds</h2>
        <p>Get instant inline citation cards, abstract drawers, and research cart overlays directly inside scholar.google.com.</p>
      </div>

      <div class="steps-grid">
        <div class="step-card">
          <span class="step-number">1</span>
          <h3>Download &amp; Extract ZIP</h3>
          <p>Download the extension package and extract the contents to a folder on your computer.</p>
        </div>

        <div class="step-card">
          <span class="step-number">2</span>
          <h3>Open Chrome Extensions</h3>
          <p>In Google Chrome, type <code>chrome://extensions</code> into your address bar and press Enter.</p>
        </div>

        <div class="step-card">
          <span class="step-number">3</span>
          <h3>Toggle Developer Mode &amp; Load</h3>
          <p>Turn on <strong>"Developer mode"</strong> in the top-right corner, click <strong>"Load unpacked"</strong>, and choose the unzipped folder.</p>
        </div>
      </div>
    </section>

    <!-- Privacy Policy Section -->
    <section id="privacy" class="showcase-section">
      <div class="section-title">
        <h2>🔒 Privacy Policy &amp; Security Guarantee</h2>
        <p>ScholarCite Express is built with a zero-telemetry, privacy-first commitment.</p>
      </div>

      <div style="background: var(--bg-card); border: 1px solid rgba(51, 65, 85, 0.7); border-radius: var(--radius-md); padding: 28px; max-width: 900px; margin: 0 auto;">
        <h3 style="color: #38bdf8; font-size: 17px; margin-bottom: 8px;">1. Zero Personal Data Collection</h3>
        <p style="font-size: 13.5px; color: #cbd5e1; margin-bottom: 16px;">
          ScholarCite Express does not collect, log, track, or sell your search history, IP address, browsing behavior, or personal identifiers.
        </p>

        <h3 style="color: #38bdf8; font-size: 17px; margin-bottom: 8px;">2. Local Device Storage</h3>
        <p style="font-size: 13.5px; color: #cbd5e1; margin-bottom: 16px;">
          All Research Cart items, saved bookmarks, and custom settings remain 100% on your local browser (via <code>localStorage</code> or <code>chrome.storage.local</code>).
        </p>

        <h3 style="color: #38bdf8; font-size: 17px; margin-bottom: 8px;">3. Direct Public Academic APIs</h3>
        <p style="font-size: 13.5px; color: #cbd5e1;">
          To fetch volume numbers, DOIs, and abstracts, the application queries public, free endpoints from Crossref, OpenAlex, and Semantic Scholar anonymously.
        </p>
      </div>
    </section>

  </div>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="footer-container">
      <div>
        <strong style="color: #fff; font-size: 14px;">🎓 ScholarCite Express</strong> &bull; Developed by 
        <a href="https://www.linkedin.com/in/beingbabu/" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: none; font-weight: 700;">
          Prof. Babu George
        </a>
      </div>

      <div class="footer-links">
        <a href="#app">Search Engine</a>
        <a href="#features">Features</a>
        <a href="#privacy">Privacy Policy</a>
        <a href="https://www.linkedin.com/in/beingbabu/" target="_blank" rel="noopener noreferrer">Contact &amp; LinkedIn</a>
      </div>
    </div>
  </footer>

  <!-- Bundled Self-Contained JavaScript Engines -->
  <script>
${citFormatter}
${docxGen}
${expEngine}
${coinsGen}
${appJs}
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(__dirname, 'index.html'), htmlTemplate, 'utf8');
fs.writeFileSync(path.join(__dirname, 'docs/index.html'), htmlTemplate, 'utf8');
fs.writeFileSync(path.join(__dirname, 'netlify-site/index.html'), htmlTemplate, 'utf8');

console.log('Successfully generated 100% self-contained single-file index.html in:');
console.log('1. ./index.html (root)');
console.log('2. ./docs/index.html');
console.log('3. ./netlify-site/index.html');
