/**
 * ScholarCite Express - Popup Controller
 * Manages 4-Tab Interface: Settings, Research Cart, Bookmarks Manager & User Guide
 */

document.addEventListener('DOMContentLoaded', function() {
  const styleSelect = document.getElementById('popup-style-select');
  const copyAllBtn = document.getElementById('popup-copy-all');
  const downloadWordBtn = document.getElementById('popup-download-word');
  const downloadMDBtn = document.getElementById('popup-download-md');
  const statusText = document.getElementById('status-text');

  const tabBtnSettings = document.getElementById('tab-btn-settings');
  const tabBtnCart = document.getElementById('tab-btn-cart');
  const tabBtnBookmarks = document.getElementById('tab-btn-bookmarks');
  const tabBtnGuide = document.getElementById('tab-btn-guide');

  const tabContentSettings = document.getElementById('tab-content-settings');
  const tabContentCart = document.getElementById('tab-content-cart');
  const tabContentBookmarks = document.getElementById('tab-content-bookmarks');
  const tabContentGuide = document.getElementById('tab-content-guide');

  const cartCountEl = document.getElementById('cart-count');
  const cartListItems = document.getElementById('cart-list-items');
  const expCartDocxBtn = document.getElementById('popup-exp-cart-docx');
  const expCartMDBtn = document.getElementById('popup-exp-cart-md');
  const clearCartBtn = document.getElementById('popup-clear-cart');

  const bookmarksCountEl = document.getElementById('bookmarks-count');
  const bookmarkTopicSelect = document.getElementById('bookmark-topic-select');
  const bookmarkListItems = document.getElementById('bookmark-list-items');
  const expBookmarksDocxBtn = document.getElementById('popup-exp-bookmarks-docx');
  const expBookmarksMDBtn = document.getElementById('popup-exp-bookmarks-md');
  const deleteSelectedBookmarksBtn = document.getElementById('popup-delete-selected-bookmarks');
  const clearAllBookmarksBtn = document.getElementById('popup-clear-all-bookmarks');

  const limitSelect = document.getElementById('popup-limit-select');
  const excludePreprintsCheckbox = document.getElementById('popup-exclude-preprints');
  const excludeIncompleteCheckbox = document.getElementById('popup-exclude-incomplete');

  let cartMap = {};
  let savedMap = {};
  let selectedTopicFilter = 'all';

  function setTabActive(activeBtn, activeContent) {
    [tabBtnSettings, tabBtnCart, tabBtnBookmarks, tabBtnGuide].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    [tabContentSettings, tabContentCart, tabContentBookmarks, tabContentGuide].forEach(content => {
      if (content) content.classList.remove('active');
    });
    if (activeBtn) activeBtn.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
  }

  // Tab Navigation Listeners
  if (tabBtnSettings) tabBtnSettings.addEventListener('click', () => setTabActive(tabBtnSettings, tabContentSettings));
  if (tabBtnCart) tabBtnCart.addEventListener('click', () => {
    setTabActive(tabBtnCart, tabContentCart);
    renderCartList();
  });
  if (tabBtnBookmarks) tabBtnBookmarks.addEventListener('click', () => {
    setTabActive(tabBtnBookmarks, tabContentBookmarks);
    renderBookmarksList();
  });
  if (tabBtnGuide) tabBtnGuide.addEventListener('click', () => setTabActive(tabBtnGuide, tabContentGuide));

  // Load Settings, Cart, and Bookmarks State
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get([
      'scholarCiteStyle', 
      'scholarCiteCart',
      'scholarCiteSaved',
      'scholarCiteExportLimit',
      'scholarCiteExcludePreprints',
      'scholarCiteExcludeIncomplete'
    ], function(result) {
      if (result.scholarCiteStyle && styleSelect) styleSelect.value = result.scholarCiteStyle;
      if (result.scholarCiteExportLimit && limitSelect) limitSelect.value = result.scholarCiteExportLimit;
      if (typeof result.scholarCiteExcludePreprints !== 'undefined' && excludePreprintsCheckbox) {
        excludePreprintsCheckbox.checked = !!result.scholarCiteExcludePreprints;
      }
      if (typeof result.scholarCiteExcludeIncomplete !== 'undefined' && excludeIncompleteCheckbox) {
        excludeIncompleteCheckbox.checked = !!result.scholarCiteExcludeIncomplete;
      }
      if (result.scholarCiteCart) {
        cartMap = result.scholarCiteCart;
        if (cartCountEl) cartCountEl.innerText = Object.keys(cartMap).length;
      }
      if (result.scholarCiteSaved) {
        savedMap = result.scholarCiteSaved;
        if (bookmarksCountEl) bookmarksCountEl.innerText = Object.keys(savedMap).length;
      }
    });
  }

  if (styleSelect) {
    styleSelect.addEventListener('change', function() {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteStyle: styleSelect.value });
      }
    });
  }

  if (limitSelect) {
    limitSelect.addEventListener('change', function() {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteExportLimit: limitSelect.value });
      }
    });
  }

  if (excludePreprintsCheckbox) {
    excludePreprintsCheckbox.addEventListener('change', function() {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteExcludePreprints: excludePreprintsCheckbox.checked });
      }
    });
  }

  if (excludeIncompleteCheckbox) {
    excludeIncompleteCheckbox.addEventListener('change', function() {
      if (chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ scholarCiteExcludeIncomplete: excludeIncompleteCheckbox.checked });
      }
    });
  }

  // Check Active Tab
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    const activeTab = tabs[0];
    const isScholar = activeTab && activeTab.url && activeTab.url.includes('scholar.google.');

    if (!isScholar) {
      statusText.innerText = 'Navigate to scholar.google.com to use';
      const statusBanner = document.getElementById('status-banner');
      if (statusBanner) statusBanner.classList.add('inactive');
      if (copyAllBtn) copyAllBtn.disabled = true;
      if (downloadWordBtn) downloadWordBtn.disabled = true;
      if (downloadMDBtn) downloadMDBtn.disabled = true;
      return;
    }

    if (statusText) statusText.innerText = 'Active on Google Scholar';

    if (copyAllBtn) {
      copyAllBtn.addEventListener('click', function() {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: (style) => {
            if (!window.ScholarCitationFormatter) return;
            const papers = (window.scholarCiteCurrentPapers && window.scholarCiteCurrentPapers.length > 0)
              ? window.scholarCiteCurrentPapers
              : (window.ScholarDOMParser ? window.ScholarDOMParser.parsePageResults() : []);
            const formatted = papers.map(p => window.ScholarCitationFormatter.format(p, style)).join('\n\n');
            navigator.clipboard.writeText(formatted).then(() => alert(`Copied ${papers.length} citations to clipboard!`));
          },
          args: [styleSelect.value]
        });
      });
    }

    if (downloadWordBtn) {
      downloadWordBtn.addEventListener('click', function() {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: (style) => {
            if (!window.ScholarDocxGenerator) return;
            const papers = (window.scholarCiteCurrentPapers && window.scholarCiteCurrentPapers.length > 0)
              ? window.scholarCiteCurrentPapers
              : (window.ScholarDOMParser ? window.ScholarDOMParser.parsePageResults() : []);
            const query = (document.querySelector('input[name="q"]') || {}).value || '';
            window.ScholarDocxGenerator.downloadWordDocument(papers, style, query, false);
          },
          args: [styleSelect.value]
        });
      });
    }

    if (downloadMDBtn) {
      downloadMDBtn.addEventListener('click', function() {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: (style) => {
            if (!window.ScholarExportEngine) return;
            const papers = (window.scholarCiteCurrentPapers && window.scholarCiteCurrentPapers.length > 0)
              ? window.scholarCiteCurrentPapers
              : (window.ScholarDOMParser ? window.ScholarDOMParser.parsePageResults() : []);
            const query = (document.querySelector('input[name="q"]') || {}).value || '';
            window.ScholarExportEngine.exportData(papers, 'markdown', style, query);
          },
          args: [styleSelect.value]
        });
      });
    }
  });

  // Render Research Cart List
  function renderCartList() {
    const keys = Object.keys(cartMap);
    if (cartCountEl) cartCountEl.innerText = keys.length;

    if (keys.length === 0) {
      if (cartListItems) {
        cartListItems.innerHTML = '<p class="empty-msg">Your Research Cart is empty. Enable "Auto-Cart Pages" on Google Scholar or click "🛒 +Cart" on any paper!</p>';
      }
      if (expCartDocxBtn) expCartDocxBtn.disabled = true;
      if (expCartMDBtn) expCartMDBtn.disabled = true;
      if (clearCartBtn) clearCartBtn.disabled = true;
      return;
    }

    if (expCartDocxBtn) expCartDocxBtn.disabled = false;
    if (expCartMDBtn) expCartMDBtn.disabled = false;
    if (clearCartBtn) clearCartBtn.disabled = false;

    let html = '';
    keys.forEach(k => {
      const p = cartMap[k];
      const cit = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(p, styleSelect.value) : p.title;
      html += `
        <div class="saved-item">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div class="saved-title" style="flex:1;">${p.title}</div>
            <button class="remove-cart-item-btn" data-key="${k}" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:14px; margin-left:8px;">&times;</button>
          </div>
          <div class="saved-cit">${cit}</div>
        </div>
      `;
    });

    if (cartListItems) {
      cartListItems.innerHTML = html;
      const removeBtns = cartListItems.querySelectorAll('.remove-cart-item-btn');
      removeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const keyToRemove = e.target.getAttribute('data-key');
          if (keyToRemove && cartMap[keyToRemove]) {
            delete cartMap[keyToRemove];
            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ scholarCiteCart: cartMap });
            }
            renderCartList();
          }
        });
      });
    }
  }

  // Render Persistent Bookmarks Manager
  function renderBookmarksList() {
    const keys = Object.keys(savedMap);
    if (bookmarksCountEl) bookmarksCountEl.innerText = keys.length;

    // Populate Topic Filter Dropdown
    if (bookmarkTopicSelect) {
      const topics = new Set();
      keys.forEach(k => {
        const topic = savedMap[k].searchTopic || 'General Research';
        topics.add(topic);
      });

      let topicHTML = '<option value="all">All Topics (' + keys.length + ')</option>';
      topics.forEach(t => {
        const count = keys.filter(k => (savedMap[k].searchTopic || 'General Research') === t).length;
        const selected = (selectedTopicFilter === t) ? 'selected' : '';
        topicHTML += `<option value="${escapeHTML(t)}" ${selected}>Topic: "${t}" (${count})</option>`;
      });
      bookmarkTopicSelect.innerHTML = topicHTML;
    }

    let filteredKeys = keys;
    if (selectedTopicFilter !== 'all') {
      filteredKeys = keys.filter(k => (savedMap[k].searchTopic || 'General Research') === selectedTopicFilter);
    }

    if (filteredKeys.length === 0) {
      if (bookmarkListItems) {
        bookmarkListItems.innerHTML = '<p class="empty-msg">No bookmarked papers match the selected topic. Click "⭐ Bookmark" on Google Scholar papers to save them!</p>';
      }
      if (expBookmarksDocxBtn) expBookmarksDocxBtn.disabled = true;
      if (expBookmarksMDBtn) expBookmarksMDBtn.disabled = true;
      if (deleteSelectedBookmarksBtn) deleteSelectedBookmarksBtn.disabled = true;
      if (clearAllBookmarksBtn) clearAllBookmarksBtn.disabled = keys.length === 0;
      return;
    }

    if (expBookmarksDocxBtn) expBookmarksDocxBtn.disabled = false;
    if (expBookmarksMDBtn) expBookmarksMDBtn.disabled = false;
    if (deleteSelectedBookmarksBtn) deleteSelectedBookmarksBtn.disabled = false;
    if (clearAllBookmarksBtn) clearAllBookmarksBtn.disabled = false;

    let html = '';
    filteredKeys.forEach(k => {
      const p = savedMap[k];
      const cit = window.ScholarCitationFormatter ? window.ScholarCitationFormatter.format(p, styleSelect.value) : p.title;
      const topicTag = p.searchTopic || 'General Research';

      html += `
        <div class="saved-item">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
            <input type="checkbox" class="bookmark-select-chk" data-key="${k}" style="cursor:pointer; width:14px; height:14px; accent-color:#38bdf8;">
            <div class="saved-title" style="flex:1;">${p.title}</div>
            <button class="remove-bookmark-btn" data-key="${k}" style="background:none; border:none; color:#ef4444; font-weight:bold; cursor:pointer; font-size:15px; margin-left:6px;">&times;</button>
          </div>
          <div style="font-size:10px; color:#38bdf8; font-weight:600; margin-bottom:2px;">📁 ${escapeHTML(topicTag)}</div>
          <div class="saved-cit">${cit}</div>
        </div>
      `;
    });

    if (bookmarkListItems) {
      bookmarkListItems.innerHTML = html;

      // Single item deletion
      const removeBtns = bookmarkListItems.querySelectorAll('.remove-bookmark-btn');
      removeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const keyToRemove = e.target.getAttribute('data-key');
          if (keyToRemove && savedMap[keyToRemove]) {
            delete savedMap[keyToRemove];
            if (chrome.storage && chrome.storage.local) {
              chrome.storage.local.set({ scholarCiteSaved: savedMap });
            }
            renderBookmarksList();
          }
        });
      });
    }
  }

  if (bookmarkTopicSelect) {
    bookmarkTopicSelect.addEventListener('change', (e) => {
      selectedTopicFilter = e.target.value;
      renderBookmarksList();
    });
  }

  // Cart Button Event Handlers
  if (expCartDocxBtn) {
    expCartDocxBtn.addEventListener('click', () => {
      const papers = Object.values(cartMap);
      if (window.ScholarDocxGenerator) {
        window.ScholarDocxGenerator.downloadWordDocument(papers, styleSelect.value, 'Research Cart', false);
      }
    });
  }

  if (expCartMDBtn) {
    expCartMDBtn.addEventListener('click', () => {
      const papers = Object.values(cartMap);
      if (window.ScholarExportEngine) {
        window.ScholarExportEngine.exportData(papers, 'markdown', styleSelect.value, 'Research Cart');
      }
    });
  }

  if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
      if (confirm('Clear all papers from your Research Cart? (Bookmarks will NOT be affected)')) {
        cartMap = {};
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ scholarCiteCart: {} });
        }
        renderCartList();
      }
    });
  }

  // Bookmarks Button Event Handlers
  function getFilteredBookmarkPapers() {
    const keys = Object.keys(savedMap);
    if (selectedTopicFilter === 'all') {
      return Object.values(savedMap);
    }
    return keys
      .filter(k => (savedMap[k].searchTopic || 'General Research') === selectedTopicFilter)
      .map(k => savedMap[k]);
  }

  if (expBookmarksDocxBtn) {
    expBookmarksDocxBtn.addEventListener('click', () => {
      const papers = getFilteredBookmarkPapers();
      if (window.ScholarDocxGenerator) {
        window.ScholarDocxGenerator.downloadWordDocument(papers, styleSelect.value, selectedTopicFilter === 'all' ? 'My Bookmarks' : selectedTopicFilter, false);
      }
    });
  }

  if (expBookmarksMDBtn) {
    expBookmarksMDBtn.addEventListener('click', () => {
      const papers = getFilteredBookmarkPapers();
      if (window.ScholarExportEngine) {
        window.ScholarExportEngine.exportData(papers, 'markdown', styleSelect.value, selectedTopicFilter === 'all' ? 'My Bookmarks' : selectedTopicFilter);
      }
    });
  }

  if (deleteSelectedBookmarksBtn) {
    deleteSelectedBookmarksBtn.addEventListener('click', () => {
      const checkboxes = bookmarkListItems ? bookmarkListItems.querySelectorAll('.bookmark-select-chk:checked') : [];
      if (checkboxes.length === 0) {
        alert('Please check at least one bookmarked paper to delete.');
        return;
      }
      if (confirm(`Delete ${checkboxes.length} selected paper(s) from your bookmarks?`)) {
        checkboxes.forEach(chk => {
          const key = chk.getAttribute('data-key');
          if (key && savedMap[key]) delete savedMap[key];
        });
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ scholarCiteSaved: savedMap });
        }
        renderBookmarksList();
      }
    });
  }

  if (clearAllBookmarksBtn) {
    clearAllBookmarksBtn.addEventListener('click', () => {
      if (confirm('Clear all bookmarked papers from your library? (Research Cart will NOT be affected)')) {
        savedMap = {};
        if (chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ scholarCiteSaved: {} });
        }
        renderBookmarksList();
      }
    });
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag));
  }
});
