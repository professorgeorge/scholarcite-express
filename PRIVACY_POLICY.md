# Privacy Policy for ScholarCite Express

**Effective Date**: August 8, 2026  
**Extension Name**: ScholarCite Express - Google Scholar Suite & LLM Exporter  
**Developer**: Professor Babu George

ScholarCite Express is built with a strict **Privacy-First Architecture**. We believe that academic research data belongs solely to the researcher. This Privacy Policy outlines our data handling practices for the ScholarCite Express Chrome Extension.

---

## 1. Zero Personal Data Collection
ScholarCite Express does **NOT** collect, track, store, or transmit any personally identifiable information (PII). We do not collect names, email addresses, IP addresses, browsing history, or search telemetry.

## 2. Local Device Data Storage
All application data generated while using ScholarCite Express—including saved Bookmarks, Research Cart items, publication filters, and citation style preferences—is stored **100% locally on your browser** using Chrome's native `chrome.storage.local` API. 

- Your research data never leaves your device.
- No external servers or databases are used to store your research notes or cart items.
- Clearing your browser cache or uninstalling the extension permanently removes locally stored items.

## 3. Third-Party Open API Requests
To enrich search results with volume numbers, issue numbers, DOIs, page ranges, and full abstracts, ScholarCite Express connects directly to open, free academic APIs:
- **Crossref REST API** (`https://api.crossref.org`)
- **OpenAlex Open API** (`https://api.openalex.org`)
- **Semantic Scholar Academic Graph API** (`https://api.semanticscholar.org`)

These API requests are executed anonymously via the extension's service worker solely to retrieve public bibliographic metadata. No personal user identifiers or cookies are sent in these requests.

## 4. Zero Data Selling & Third-Party Sharing
ScholarCite Express certifies that:
- We do **NOT** sell, rent, or trade user data to third parties under any circumstances.
- We do **NOT** use user data for advertising, targeted marketing, credit scoring, or monetization.
- We do **NOT** track user behavior across websites.

## 5. Permissions Used & Justification
- `storage`: Required strictly to store your saved citation styles, Research Cart items, and Bookmarks locally on your computer.
- `host_permissions` (`https://scholar.google.com/*`, `https://api.crossref.org/*`, `https://api.openalex.org/*`, `https://api.semanticscholar.org/*`): Required to inject the citation interface onto Google Scholar and fetch open bibliographic metadata from public research APIs.

## 6. Open Source & Transparency
ScholarCite Express is 100% free and transparent. All source code is open for user inspection.

## 7. Contact Information
If you have any questions or feedback regarding this Privacy Policy, please contact:  
**Developer**: Professor Babu George  
**LinkedIn**: [https://www.linkedin.com/in/beingbabu/](https://www.linkedin.com/in/beingbabu/)
