// Shows "ON" on the extension icon while the dark theme is enabled.
importScripts('settings.js');

const badge = (on) => {
  chrome.action.setBadgeText({ text: on ? 'ON' : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#0891b2' });
};
const refresh = () => chrome.storage.sync.get({ dark: SNCL_DEFAULTS.dark }, (s) => badge(s.dark));

chrome.runtime.onInstalled.addListener(refresh);
chrome.runtime.onStartup.addListener(refresh);
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'sync' && changes.dark) refresh(); });
