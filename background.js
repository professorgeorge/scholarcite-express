/**
 * ScholarCite Express - Background Service Worker (MV3)
 * Proxies cross-origin API requests (Crossref, Semantic Scholar, OpenAlex)
 * using extension host permissions to bypass web page CSP and CORS restrictions.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'FETCH_API') {
    handleApiFetch(request)
      .then(data => sendResponse({ success: true, data: data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keeps the message channel open for async response
  }
});

async function handleApiFetch(request) {
  const { url, options = {} } = request;

  const defaultHeaders = {
    'Accept': 'application/json, text/plain, */*'
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers: Object.assign({}, defaultHeaders, options.headers || {}),
    credentials: options.credentials || 'omit'
  };

  if (options.body) {
    fetchOptions.body = options.body;
  }

  const response = await fetch(url, fetchOptions);
  
  if (!response.ok) {
    throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await response.json();
  } else {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }
}
