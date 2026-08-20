/**
 * ScholarCite Express - Microsoft Word (.docx) Document Exporter
 * Generates clean, publication-ready Word documents for References and Annotated Bibliographies.
 * CLEAN EXPORT: Contains NO app footers, signatures, or credits.
 */

window.ScholarDocxGenerator = {
  /**
   * Download Word document containing formatted references or annotated bibliography.
   * @param {Array<Object>} papers - Array of paper objects or citation strings
   * @param {string} style - Active style (APA, MLA, Chicago, IEEE, Harvard)
   * @param {string} searchQuery - Search query title
   * @param {boolean} includeAbstracts - Whether to format as Annotated Bibliography
   */
  downloadWordDocument: function(papers, style = 'APA', searchQuery = '', includeAbstracts = false) {
    if (window.ScholarExportEngine && window.ScholarExportEngine.deduplicatePapers) {
      papers = window.ScholarExportEngine.deduplicatePapers(papers);
    }
    if (!papers || papers.length === 0) {
      alert('No items available to export.');
      return;
    }

    const docHeading = includeAbstracts 
      ? 'Annotated Bibliography' 
      : ((style.toLowerCase() === 'mla') ? 'Works Cited' : 'References');

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    let bodyItemsHTML = '';

    papers.forEach(paper => {
      let citationText = typeof paper === 'string' 
        ? paper 
        : (window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(paper, style) : paper.title);

      const htmlCitation = this.formatCitationHTML(citationText);

      if (includeAbstracts && typeof paper === 'object') {
        const abstract = paper.abstract || paper.snippet || 'No abstract available.';
        bodyItemsHTML += `
          <div class="entry-block">
            <p class="citation-item">${htmlCitation}</p>
            <div class="abstract-box">
              <p class="abstract-label"><strong>Abstract:</strong></p>
              <p class="abstract-text">${this.escapeHTML(abstract)}</p>
            </div>
          </div>
        `;
      } else {
        bodyItemsHTML += `<p class="citation-item">${htmlCitation}</p>\n`;
      }
    });

    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${docHeading}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForCustomXSL/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          @page {
            size: 8.5in 11.0in;
            margin: 1.0in 1.0in 1.0in 1.0in;
          }
          body {
            font-family: "Times New Roman", Times, serif;
            font-size: 12pt;
            line-height: 1.5;
            color: #000000;
          }
          h1.doc-heading {
            text-align: center;
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 18pt;
          }
          .meta-info {
            font-size: 10pt;
            color: #444444;
            text-align: center;
            margin-bottom: 24pt;
            font-style: italic;
          }
          .entry-block {
            margin-bottom: 18pt;
          }
          p.citation-item {
            margin-top: 0pt;
            margin-bottom: 8pt;
            margin-left: 0.5in;
            text-indent: -0.5in;
            text-align: left;
            word-wrap: break-word;
          }
          .abstract-box {
            margin-left: 0.5in;
            margin-bottom: 14pt;
            font-size: 11pt;
            color: #222222;
            line-height: 1.4;
          }
          .abstract-label {
            margin-bottom: 2pt;
            font-weight: bold;
          }
          .abstract-text {
            text-align: justify;
          }
        </style>
      </head>
      <body>
        <h1 class="doc-heading">${docHeading}</h1>
        <div class="meta-info">
          Format: <strong>${style.toUpperCase()}</strong> | Date: ${dateStr}
          ${searchQuery ? `<br>Topic: "${this.escapeHTML(searchQuery)}"` : ''}
        </div>

        <div class="bibliography-list">
          ${bodyItemsHTML}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', htmlContent], {
      type: 'application/msword;charset=utf-8'
    });

    const fileName = `${docHeading.replace(/\s+/g, '_')}_${style.toUpperCase()}_${new Date().toISOString().slice(0, 10)}.doc`;

    if (navigator.msSaveOrOpenBlob) {
      navigator.msSaveOrOpenBlob(blob, fileName);
    } else {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    }
  },

  formatCitationHTML: function(text) {
    if (!text) return '';
    return text.replace(/\*(.*?)\*/g, '<i>$1</i>');
  },

  escapeHTML: function(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }
};
