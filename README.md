# 🎓 ScholarCite Express v1.2.0

> **Google Scholar Suite, Inline Citation Layer & LLM Exporter**  
> A free, privacy-first, zero-throttling Chrome Extension (Manifest V3) for research scholars.

ScholarCite Express automatically enhances **Google Scholar** (`scholar.google.com`) with an inline citation layer, full multi-paragraph abstracts, publication type filters (Journals, Books, Conferences, Preprints), Open Access PDF badges, Multi-Page Research Cart accumulation, COinS Zotero/Mendeley auto-detection, and multi-format exporters (Markdown for LLMs, JSON, Word `.docx`, BibTeX, RIS).

---

## ✨ Key Features

- 🎨 **Glassmorphic Control Dock**: Sleek, semi-transparent dock integrated seamlessly at the top of Google Scholar search results.
- 🎓 **Inline Citation Cards & Rank Badges (#1 - #10)**: Instant citations in **APA 7th, MLA 9th, Chicago 17th, IEEE, Harvard, and BibTeX** with position rank badges (`#1`, `#2`...) and publication type badges (`📰 JOURNAL`, `📚 BOOK`, `🏛️ CONFERENCE`, `📄 PREPRINT`).
- ⚡ **Parallel Batch 0% CAPTCHA Enrichment**: Fetches volume, issue, page range, DOI, and full abstracts in **parallel batches (3 at a time)** via **100% Free Open APIs** (Crossref, OpenAlex, Semantic Scholar) through an MV3 service worker—0% CAPTCHA risk.
- 🔥 **Visual Citation Impact & H-Index Metrics**: Displays visual badges (`🔥 Highly Cited (100+)`, `⭐ Influential (25+)`, `🌱 Emerging`) and calculates **Total Dataset Citations**, **Average Citations per Paper**, and **Dataset H-Index Benchmark**.
- 🏷️ **Research Topic & Keyword Extraction**: Scans title and abstract text to extract domain tags (`#Empirical`, `#DeepLearning`, `#Survey`, `#Framework`) for instant theme scanning.
- 🛒 **Multi-Page Research Cart Accumulator**: Accumulate and deduplicate papers across multiple search queries and paginated results (Pages 1, 2, 3...) for batch export.
- ⭐ **Persistent Bookmarks Manager**: 4-tab Extension Popup with a full-screen Bookmarks Manager featuring topic filter dropdowns, selection checkboxes, and bulk deletion (`🗑️ Delete Selected`).
- 🤖 **7 Academic LLM Prompts Suite (Including 👑 God-Mode)**: Includes pre-built prompts for Gemini, NotebookLM, ChatGPT, and Claude:
  - 👑 **God-Mode**: Full 7-section publication manuscript generator
  - 📋 **Synthesis** | 🔍 **Research Gaps** | 📊 **Methodology Matrix** | 💡 **Theoretical Frameworks** | 🥊 **Conflicting Findings** | ⚡ **Practical Implications**
- 📥 **Multi-Format Exporters**: Export datasets into **Markdown (`.md`)**, **JSON (`.json`)**, **Word References (`.docx`)**, **Annotated Bibliography (`.docx`)**, **BibTeX (`.bib`)**, **RIS (`.ris`)**, and **Open Access PDF Links (`.txt`)**.
- 🏷️ **COinS OpenURL Z39.88 Integration**: Embeds OpenURL metadata into every card for instant Zotero Connector, Mendeley Web Importer, and EndNote Web auto-detection.
- 🔓 **Open Access PDF One-Click Badges**: Detects legal free Open Access PDFs and provides 1-click direct download links.
- 🚫 **Quality Filters**: Exclude preprints (arXiv, SSRN, bioRxiv) and incomplete citation data with 1 click.
- 🧹 **Clean Export Guarantee**: **NO credits, footers, or signatures** are added to exported files. All generated files are 100% publication-ready.
- 📖 **Built-in User Guide & Documentation**: Interactive help modal accessible directly from the dock and extension popup.

---

## 🚀 How to Install in Google Chrome (or Edge / Brave)

1. Open **Google Chrome** and navigate to `chrome://extensions`.
2. Enable **Developer mode** using the toggle switch in the upper-right corner.
3. Click the **Load unpacked** button in the top-left menu.
4. Select the project folder:
   `C:\Users\babug\.gemini\antigravity\scratch\scholarcite-express`
5. Go to [scholar.google.com](https://scholar.google.com) and search for any query!

---

## 🌐 Standalone Web Application & Live Demo

ScholarCite Express is also available as a **standalone, client-side Web Application** that works in any browser without installing an extension!

- **Live Web App & Showcase**: Located in [`docs/`](file:///c:/Users/babug/.gemini/antigravity/scratch/scholarcite-express/docs) & [`netlify-site/`](file:///c:/Users/babug/.gemini/antigravity/scratch/scholarcite-express/netlify-site).
- **Features**: Live academic search querying OpenAlex & Crossref, 6 citation formats, multi-format exports (Word, Markdown for LLMs, JSON, BibTeX, RIS), and 👑 God-Mode LLM prompts.
- **Publish to GitHub Pages / Netlify**: See [`DEPLOYMENT.md`](file:///c:/Users/babug/.gemini/antigravity/scratch/scholarcite-express/DEPLOYMENT.md) for 2-minute step-by-step publishing instructions.

---

## 🛠️ Project Structure

```
scholarcite-express/
├── manifest.json              # Extension Manifest V3 configuration
├── background.js              # Service Worker for cross-origin API proxying
├── DEPLOYMENT.md              # GitHub Pages, Netlify & Vercel deployment guide
├── docs/                      # Standalone Web Application (GitHub Pages deployable)
│   ├── index.html             # Web app & showcase landing page
│   ├── app.css                # Glassmorphic dark-slate stylesheet
│   ├── app.js                 # Client-side search engine & export controller
│   └── lib/                   # Shared citation, docx & export engines
├── netlify-site/              # Standalone Web Application (Netlify deployable)
├── lib/
│   ├── domParser.js           # Google Scholar DOM parser & publication classifier
│   ├── scholarEnricher.js     # Volume, Issue, Pages & DOI enrichment (Crossref & OpenAlex)
│   ├── abstractFetcher.js     # Multi-source abstract fetcher (OpenAlex, Crossref, S2)
│   ├── citationFormatter.js   # Multi-style citation formatting engine
│   ├── coinsGenerator.js      # OpenURL COinS Z39.88 generator for Zotero/Mendeley
│   ├── docxGenerator.js       # Clean Word (.docx) document builder
│   └── exportEngine.js        # Multi-format LLM & Academic exporter (Markdown, JSON, BibTeX, RIS)
├── content/
│   ├── content.js             # Content script injecting glassmorphic dock, cards & modals
│   └── content.css            # Glassmorphism, publication badges & modal styling
├── popup/
│   ├── popup.html             # Tabbed popup UI (Settings, Research Cart, User Guide)
│   ├── popup.js               # Popup controller & cart manager
│   └── popup.css              # Dark-mode popup stylesheet
└── icons/                     # Extension PNG icons (16px, 48px, 128px)
```

---

## 🙏 Credits & Attribution

App-level inspiration and fine-print credits to **[Professor Babu George](https://www.linkedin.com/in/beingbabu/)**.  
*(Note: Credits remain strictly at the app UI level and are 100% excluded from all downloaded research files).*
