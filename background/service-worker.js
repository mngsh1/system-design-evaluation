/**
 * Background Service Worker (Manifest V3)
 * Manages full-tab studio lifecycle, single-instance navigation, and message coordination.
 */

async function openOrFocusStudio(queryParam = '') {
  const studioUrl = chrome.runtime.getURL(`app/index.html${queryParam ? '?' + queryParam : ''}`);
  const studioBaseUrl = chrome.runtime.getURL('app/index.html');

  // Search for existing tabs running the Studio
  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find(t => t.url && t.url.startsWith(studioBaseUrl));

  if (existingTab && existingTab.id) {
    // Focus the existing tab and window
    await chrome.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    if (queryParam) {
      await chrome.tabs.update(existingTab.id, { url: studioUrl });
    }
    return existingTab;
  } else {
    // Create new focused tab
    return await chrome.tabs.create({ url: studioUrl, active: true });
  }
}

// Listen for messages from popup or other extension contexts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_STUDIO') {
    (async () => {
      try {
        const tab = await openOrFocusStudio(message.query || '');
        sendResponse({ success: true, tabId: tab.id });
      } catch (error) {
        console.error('Error opening studio tab:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'GET_SESSION_SUMMARY') {
    (async () => {
      try {
        const { copilot_active_session } = await chrome.storage.local.get('copilot_active_session');
        sendResponse({ success: true, session: copilot_active_session || null });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true;
  }
});
