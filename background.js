// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  // Initialize storage with empty arrays
  chrome.storage.local.set({
    snippets: [],
    categories: [],
    customVariables: {}
  });
});