/**
 * ScholarCite Express - Multi-Format Export & LLM Dataset Engine
 * Handles exports for Markdown (.md), JSON (.json), Text (.txt), BibTeX (.bib), and RIS (.ris).
 * CLEAN EXPORT: Contains NO extension signatures or credit footers.
 */

window.ScholarExportEngine = {
  deduplicatePapers: function(papers) {
    if (!Array.isArray(papers)) return [];
    const seen = new Set();
    return papers.filter(p => {
      if (!p) return false;
      const key = (typeof p === 'string' ? p : (p.cid || p.doi || p.title || '')).toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  },

  /**
   * Export papers in requested format
   * @param {Array<Object>} papers - Array of paper objects
   * @param {string} format - 'markdown' | 'json' | 'text' | 'bibtex' | 'ris'
   * @param {string} style - Citation style (APA, MLA, etc.)
   * @param {string} query - Search query title
   */
  exportData: function(papers, format = 'markdown', style = 'apa', query = '') {
    papers = this.deduplicatePapers(papers);
    if (!papers || papers.length === 0) {
      alert('No papers available to export.');
      return;
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const safeQuery = (query || 'Scholar_Export').replace(/[^a-zA-Z0-9_\-]/g, '_');

    let fileContent = '';
    let mimeType = 'text/plain';
    let fileExt = 'txt';

    switch (format.toLowerCase()) {
      case 'markdown':
      case 'md':
        fileContent = this.generateMarkdownLLM(papers, style, query);
        mimeType = 'text/markdown;charset=utf-8';
        fileExt = 'md';
        break;

      case 'json':
        fileContent = JSON.stringify(this.generateJSONSchema(papers, style, query), null, 2);
        mimeType = 'application/json;charset=utf-8';
        fileExt = 'json';
        break;

      case 'text':
        fileContent = this.generatePlainText(papers, style);
        mimeType = 'text/plain;charset=utf-8';
        fileExt = 'txt';
        break;

      case 'bibtex':
      case 'bib':
        fileContent = papers.map(p => 
          window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(p, 'bibtex') : p.title
        ).join('\n\n');
        mimeType = 'text/plain;charset=utf-8';
        fileExt = 'bib';
        break;

      case 'ris':
        fileContent = this.generateRIS(papers);
        mimeType = 'text/plain;charset=utf-8';
        fileExt = 'ris';
        break;

      default:
        fileContent = this.generatePlainText(papers, style);
    }

    // Trigger Browser Download
    const fileName = `ScholarCite_${safeQuery}_${style.toUpperCase()}_${dateStr}.${fileExt}`;
    const blob = new Blob([fileContent], { type: mimeType });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  calculateMetrics: function(papers) {
    if (!Array.isArray(papers) || papers.length === 0) {
      return { totalCitations: 0, avgCitations: 0, hIndex: 0, highlyCitedCount: 0 };
    }
    const counts = papers.map(p => (p.citeCount || 0)).sort((a, b) => b - a);
    const totalCitations = counts.reduce((sum, c) => sum + c, 0);
    const avgCitations = Math.round(totalCitations / papers.length);
    let hIndex = 0;
    for (let i = 0; i < counts.length; i++) {
      if (counts[i] >= i + 1) hIndex = i + 1;
      else break;
    }
    const highlyCitedCount = counts.filter(c => c >= 100).length;
    return { totalCitations, avgCitations, hIndex, highlyCitedCount };
  },

  exportPDFLinks: function(papers, query = '') {
    papers = this.deduplicatePapers(papers);
    const pdfPapers = papers.filter(p => p.openAccessPdf);
    if (pdfPapers.length === 0) {
      alert('No Open Access PDF links found in the current selection.');
      return;
    }
    let content = `# Open Access PDF Direct Links (${pdfPapers.length} Files)\n`;
    content += `# Query / Topic: ${query || 'Scholar Export'}\n`;
    content += `# Generated: ${new Date().toLocaleDateString('en-US')}\n\n`;
    pdfPapers.forEach((p, i) => {
      content += `[${i + 1}] ${p.title}\n${p.openAccessPdf}\n\n`;
    });

    const safeQuery = (query || 'PDF_Links').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const fileName = `ScholarCite_${safeQuery}_OA_PDFs.txt`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  },

  /**
   * Generate Markdown structured specifically for LLMs (Gemini, ChatGPT, Claude, NotebookLM)
   */
  generateMarkdownLLM: function(papers, style, query) {
    const metrics = this.calculateMetrics(papers);

    let md = `# Research Dataset (${papers.length} Papers)\n`;
    if (query) md += `**Topic / Query**: "${query}"\n`;
    md += `**Citation Style**: ${style.toUpperCase()}\n`;
    md += `**Date**: ${new Date().toLocaleDateString('en-US')}\n\n`;
    md += `### 📊 Citation Impact & Benchmark Metrics\n`;
    md += `- **Total Dataset Citations**: ${metrics.totalCitations.toLocaleString()} citations\n`;
    md += `- **Average Citations per Paper**: ${metrics.avgCitations.toLocaleString()}\n`;
    md += `- **Dataset H-Index Benchmark**: ${metrics.hIndex}\n`;
    md += `- **Highly Cited Papers (100+ Citations)**: ${metrics.highlyCitedCount} paper(s)\n\n`;
    md += `---\n\n`;

    papers.forEach((p, idx) => {
      const citation = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(p, style) : p.title;
      const abstract = p.abstract || p.snippet || 'No abstract available.';

      md += `### Paper ${idx + 1}: ${p.title}\n`;
      md += `- **Authors**: ${p.authorString || (p.authors ? p.authors.join(', ') : 'Unknown')}\n`;
      md += `- **Year**: ${p.year || 'n.d.'}\n`;
      md += `- **Venue / Journal**: ${p.fullVenue || p.venue || 'N/A'}\n`;
      if (p.volume) md += `- **Volume / Issue**: Vol. ${p.volume}${p.issue ? `, No. ${p.issue}` : ''}\n`;
      if (p.pages) md += `- **Pages**: ${p.pages}\n`;
      md += `- **Type**: ${(p.type || 'journal').toUpperCase()}\n`;
      md += `- **Citations**: ${p.citeCount ? p.citeCount.toLocaleString() : 'N/A'}\n`;
      md += `- **Citation (${style.toUpperCase()})**: ${citation.replace(/\*(.*?)\*/g, '$1')}\n`;
      if (p.doi) md += `- **DOI**: https://doi.org/${p.doi}\n`;
      if (p.url) md += `- **Link**: ${p.url}\n`;
      if (p.openAccessPdf) md += `- **Open Access PDF**: ${p.openAccessPdf}\n`;
      md += `\n**Abstract**:\n${abstract}\n\n`;
      md += `---\n\n`;
    });

    md += `## 👑 God-Mode: Full Academic Research Paper Prompt\n`;
    md += `> ACT AS A WORLD-CLASS SENIOR RESEARCH PROFESSOR AND JOURNAL EDITOR-IN-CHIEF. Draft a comprehensive, rigorous, publication-ready Academic Research Paper based strictly on the attached literature dataset covering: Title, Abstract (200 words), 1. Introduction & Research Questions, 2. Theoretical Framework & Narrative Review, 3. Methodological Landscape & Comparative Analysis, 4. Critical Discussion & Empirical Discrepancies, 5. Strategic Research Gaps & Hypotheses, 6. Practical & Policy Implications, 7. Conclusion, and Complete References.\n\n`;
    md += `## 🤖 Specialized Academic Analysis Prompts\n\n`;
    md += `### 1. Literature Review Synthesis\n> Act as a senior academic researcher. Synthesize the attached research dataset into a structured Literature Review paper with sections: 1. Executive Summary & Core Themes, 2. Comparative Methodological Overview, 3. Critical Empirical Findings & Contributions, 4. Unaddressed Research Gaps, 5. Strategic Future Research Directions.\n\n`;
    md += `### 2. Research Gaps & Future Directions\n> Analyze the methodologies, samples, and empirical findings of the attached research papers. Identify 5 significant research gaps that remain unaddressed in current literature and propose actionable research questions to address them.\n\n`;
    md += `### 3. Methodology Matrix\n> Act as a senior methodology reviewer. Construct a structured Methodology Matrix table from the attached literature dataset with columns: [Paper Citation, Study Design, Sample Size & Population, Key Variables/Constructs, Primary Analytical Methodology, Limitations]. Synthesize common methodological trends across studies.\n\n`;
    md += `### 4. Theoretical Frameworks & Models\n> Act as a theoretical scholar. Identify: 1) The primary theoretical frameworks used across these studies, 2) Key conceptual definitions and construct relationships, 3) How different authors build upon or critique earlier theories, and 4) An integrative theoretical model summarizing current knowledge.\n\n`;
    md += `### 5. Conflicting Findings & Debates\n> Act as an academic peer reviewer. Analyze the attached literature dataset to identify points of controversy, empirical contradictions, and conflicting findings among authors. Highlight: 1) What core findings authors agree on, 2) Where authors disagree, 3) Potential reasons for these discrepancies, and 4) Questions that remain unresolved.\n\n`;
    md += `### 6. Practical & Policy Implications\n> Act as an applied research consultant. Synthesize key practical and policy implications from the attached dataset into: 1) Core executive takeaways for industry practitioners/policymakers, 2) Actionable recommendations grounded in empirical evidence, and 3) Implementation challenges and risk factors identified in the research.\n\n`;

    return md;
  },

  /**
   * Generate clean JSON Schema for AI Agents & Python RAG pipelines
   */
  generateJSONSchema: function(papers, style, query) {
    return {
      metadata: {
        exported_at: new Date().toISOString(),
        query: query || 'Scholar_Export',
        style: style.toUpperCase(),
        total_papers: papers.length
      },
      papers: papers.map((p, idx) => ({
        index: idx + 1,
        title: p.title,
        authors: p.authors || [],
        author_string: p.authorString || (p.authors ? p.authors.join(', ') : 'Unknown'),
        year: p.year || 'n.d.',
        venue: p.fullVenue || p.venue,
        volume: p.volume || null,
        issue: p.issue || null,
        pages: p.pages || null,
        publication_type: p.type || 'journal',
        doi: p.doi ? `https://doi.org/${p.doi}` : null,
        url: p.url || null,
        open_access_pdf: p.openAccessPdf || null,
        citation_formatted: window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(p, style).replace(/\*(.*?)\*/g, '$1') : p.title,
        abstract: p.abstract || p.snippet || ''
      }))
    };
  },

  generatePlainText: function(papers, style) {
    return papers.map((p, i) => {
      const cit = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(p, style).replace(/\*(.*?)\*/g, '$1') : p.title;
      return `[${i + 1}] ${cit}`;
    }).join('\n\n');
  },

  /**
   * Generate RIS format for EndNote / RefMan
   */
  generateRIS: function(papers) {
    let ris = '';
    papers.forEach(p => {
      ris += `TY  - JOUR\n`;
      ris += `TI  - ${p.title}\n`;
      if (p.authors && p.authors.length > 0) {
        p.authors.forEach(a => { ris += `AU  - ${a}\n`; });
      }
      if (p.year) ris += `PY  - ${p.year}\n`;
      if (p.venue || p.fullVenue) ris += `JO  - ${p.fullVenue || p.venue}\n`;
      if (p.volume) ris += `VL  - ${p.volume}\n`;
      if (p.issue) ris += `IS  - ${p.issue}\n`;
      if (p.pages) ris += `SP  - ${p.pages}\n`;
      if (p.url) ris += `UR  - ${p.url}\n`;
      if (p.abstract) ris += `N2  - ${p.abstract}\n`;
      ris += `ER  - \n\n`;
    });
    return ris;
  },

  /**
   * Prompt templates for LLM Literature Review Synthesis & Extraction
   */
  getLLMPrompts: function() {
    return {
      godmode: `ACT AS A WORLD-CLASS SENIOR RESEARCH PROFESSOR AND JOURNAL EDITOR-IN-CHIEF.

Your objective is to write a comprehensive, rigorous, publication-ready Academic Research Paper based strictly on the attached literature dataset.

STRUCTURE & INSTRUCTIONS FOR THE MANUSCRIPT:

# [Generate an In-Depth Academic Title Based on Dataset]

## Abstract
Write a 200-word structured abstract covering: 1) Background & Problem Statement, 2) Research Objectives, 3) Methodological Overview, 4) Core Empirical Findings, and 5) Significance & Implications.

## 1. Introduction & Background
- Frame the societal, theoretical, and practical significance of this research topic.
- Define core terms and constructs.
- State clear Research Questions (RQ1, RQ2, RQ3).
- Provide an overview of the manuscript's organization.

## 2. Theoretical Framework & Narrative Literature Review
- Synthesize core theoretical paradigms referenced across the papers.
- Map out key conceptual models and construct relationships.
- Compare how different authors build upon, validate, or refine earlier theoretical frameworks.
- Present an integrative conceptual diagram or summary model.

## 3. Methodological Landscape & Comparative Analysis
- Provide a comparative evaluation of the research methods, sample sizes, data collection instruments, and analytical tools used across the literature dataset.
- Critique methodological strengths and acknowledge pervasive empirical limitations.

## 4. Synthesis of Findings & Critical Discussion
- Synthesize major empirical findings across all papers under thematic sub-headings.
- Discuss areas of empirical consensus vs. areas of debate and conflicting results.
- Explain potential reasons for discrepancies (e.g., sample differences, geographical context, measurement variations).

## 5. Strategic Research Gaps & Future Research Agenda
- Identify 5 major unaddressed research gaps in current literature.
- Formulate testable hypotheses (H1, H2, H3) and specific research questions to guide future empirical investigation.

## 6. Practical, Managerial & Policy Implications
- Translate empirical insights into actionable recommendations for practitioners, managers, and policymakers.
- Highlight risk factors and implementation barriers.

## 7. Conclusion
- Provide a high-level summary concluding the research synthesis.

## References
- List all cited papers from the dataset in clean, complete academic reference format.`,

      synthesis: `Act as a senior academic researcher. Synthesize the attached research paper dataset into a structured Literature Review paper with the following sections:\n1. Executive Summary & Themes\n2. Key Methodologies Compared\n3. Critical Findings & Contributions\n4. Unaddressed Research Gaps\n5. Future Research Directions`,
      gaps: `Analyze the methodologies and findings of the attached research papers. Identify 5 significant research gaps that are unaddressed in current literature and propose actionable research questions to address them.`,
      methodology: `Act as a senior methodology reviewer. Analyze the attached literature dataset and construct a structured Methodology Matrix table with columns: [Paper Citation, Study Design, Sample Size & Population, Key Variables/Constructs, Primary Analytical Methodology, Limitations]. Synthesize common methodological trends across studies.`,
      theory: `Act as a theoretical scholar. Identify: 1) The primary theoretical frameworks used across these studies, 2) Key conceptual definitions and construct relationships, 3) How different authors build upon or critique earlier theories, and 4) An integrative theoretical model summarizing current knowledge.`,
      conflicts: `Act as an academic peer reviewer. Analyze the attached literature dataset to identify points of controversy, empirical contradictions, and conflicting findings among authors. Highlight: 1) What core findings authors agree on, 2) Where authors disagree, 3) Potential reasons for these discrepancies, and 4) Questions that remain unresolved.`,
      implications: `Act as an applied research consultant. Synthesize key practical and policy implications from the attached dataset into: 1) Core executive takeaways for industry practitioners/policymakers, 2) Actionable recommendations grounded in empirical evidence, and 3) Implementation challenges and risk factors identified in the research.`
    };
  }
};
