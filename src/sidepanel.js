import { buildOrionisMarkdown } from "./markdown-template.js";

const MESSAGE_TYPE = "ORIONIS_EXTRACT_LINKEDIN_JOB";

const markdownEditor = document.querySelector("#markdown");
const statusText = document.querySelector("#status");
const refreshButton = document.querySelector("#refresh");
const copyButton = document.querySelector("#copy");

refreshButton.addEventListener("click", captureCurrentTab);
copyButton.addEventListener("click", copyMarkdown);

captureCurrentTab();

async function captureCurrentTab() {
  setStatus("Reading the current LinkedIn page...");
  refreshButton.disabled = true;

  try {
    const tab = await getActiveTab();

    if (!tab?.id || !isLinkedInJobsUrl(tab.url)) {
      throw new Error("Open a LinkedIn job page before capturing.");
    }

    const job = await requestJobData(tab.id);
    markdownEditor.value = buildOrionisMarkdown(job);
    setStatus("Markdown generated. Review and edit anything that needs cleanup.");
  } catch (error) {
    setStatus(error.message || "Could not capture this page.");
  } finally {
    refreshButton.disabled = false;
  }
}

async function copyMarkdown() {
  try {
    await navigator.clipboard.writeText(markdownEditor.value);
    setStatus("Markdown copied.");
  } catch (_error) {
    markdownEditor.select();
    document.execCommand("copy");
    setStatus("Markdown copied.");
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function requestJobData(tabId) {
  try {
    return await sendExtractMessage(tabId);
  } catch (_error) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["src/content-script.js"]
    });

    return sendExtractMessage(tabId);
  }
}

async function sendExtractMessage(tabId) {
  const response = await chrome.tabs.sendMessage(tabId, { type: MESSAGE_TYPE });

  if (!response?.ok) {
    throw new Error("LinkedIn job data was not available on this page.");
  }

  return response.job;
}

function isLinkedInJobsUrl(url) {
  return /^https:\/\/www\.linkedin\.com\/jobs\//.test(url || "");
}

function setStatus(message) {
  statusText.textContent = message;
}
