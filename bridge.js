// Isolated world: reads the user's settings from chrome.storage.sync and passes them to
// content.js (MAIN world) via attributes on <html>:
//   data-sowcl-dark    – present when the dark theme is enabled
//   data-sowcl-config  – JSON with paneWidth, filterEnabled, postTypes, enforcePrefs, enforceEnglish
(() => {
  const apply = (s) => {
    const html = document.documentElement;
    if (s.dark) html.setAttribute('data-sowcl-dark', '');
    else html.removeAttribute('data-sowcl-dark');
    html.setAttribute('data-sowcl-config', JSON.stringify({
      descriptionAtBottom: s.descriptionAtBottom,
      paneWidth: Number(s.paneWidth) || 0,
      filterEnabled: !!s.filterEnabled,
      postTypes: Array.isArray(s.postTypes) ? s.postTypes : [],
      enforcePrefs: !!s.enforcePrefs,
      enforceEnglish: !!s.enforceEnglish,
    }));
  };
  const load = () => chrome.storage.sync.get(SNCL_DEFAULTS, apply);
  load();
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'sync') load(); });

  // Popup → page: create predefined lists. The actual REST calls run in content.js (MAIN world),
  // which has the ServiceNow session token.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'sncl:add-lists') return false;
    const nonce = Math.random().toString(36).slice(2);
    const onReply = (ev) => {
      const d = ev.data;
      if (ev.source !== window || !d || d.type !== 'sncl:add-lists:result' || d.nonce !== nonce) return;
      window.removeEventListener('message', onReply);
      clearTimeout(timer);
      sendResponse(d);
    };
    const timer = setTimeout(() => {
      window.removeEventListener('message', onReply);
      sendResponse({ ok: false, error: 'No answer from the ServiceNow page – reload it and try again.' });
    }, 20000);
    window.addEventListener('message', onReply);
    window.postMessage({ type: 'sncl:add-lists', ids: msg.ids, nonce }, location.origin);
    return true; // async response
  });
})();
