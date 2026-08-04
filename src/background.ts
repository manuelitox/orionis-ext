import type { ActiveTabMetadata, GetActiveTabMetadataMessage } from "./types.js";

let lastActionTab: ActiveTabMetadata = {};

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});

chrome.action.onClicked.addListener((tab) => {
  lastActionTab = {
    id: tab.id,
    url: tab.url
  };

  if (typeof tab.id === "number") {
    chrome.sidePanel.setOptions({
      tabId: tab.id,
      path: buildSidePanelPath(tab),
      enabled: true
    });
    chrome.sidePanel.open({ tabId: tab.id });
  } else if (typeof tab.windowId === "number") {
    chrome.sidePanel.open({ windowId: tab.windowId });
  }
});

chrome.runtime.onMessage.addListener((message: GetActiveTabMetadataMessage, _sender, sendResponse) => {
  if (message?.type !== "ORIONIS_GET_ACTIVE_TAB_METADATA") {
    return false;
  }

  sendResponse(lastActionTab);
  return false;
});

function buildSidePanelPath(tab: chrome.tabs.Tab): string {
  const params = new URLSearchParams();

  if (typeof tab.id === "number") {
    params.set("tabId", String(tab.id));
  }

  if (tab.url) {
    params.set("url", tab.url);
  }

  return `src/sidepanel.html?${params.toString()}`;
}
