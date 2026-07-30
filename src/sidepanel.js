import { buildOrionisMarkdown } from "./markdown-template.js";

const MESSAGE_TYPE = "ORIONIS_EXTRACT_JOB";

const markdownEditor = document.querySelector("#markdown");
const statusText = document.querySelector("#status");
const refreshButton = document.querySelector("#refresh");
const copyButton = document.querySelector("#copy");
const saveButton = document.querySelector("#save");

let rolesDirectoryHandle = null;

refreshButton.addEventListener("click", captureCurrentTab);
copyButton.addEventListener("click", copyMarkdown);
saveButton.addEventListener("click", saveRole);

captureCurrentTab();

async function captureCurrentTab() {
  setStatus("Reading the current job page...");
  refreshButton.disabled = true;

  try {
    const tab = await getActiveTab();

    if (!tab?.id || !isSupportedJobUrl(tab.url)) {
      throw new Error("Open a LinkedIn, Wellfound, BigRemoteJob, Not Yet Unicorns, or Ashby job page before capturing.");
    }

    const job = await requestJobData(tab.id);
    markdownEditor.value = buildOrionisMarkdown(job);
    setStatus("Markdown ready. Review, copy, or save it.");
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

async function saveRole() {
  const markdown = markdownEditor.value.trim();

  if (!markdown) {
    setStatus("Nothing to save yet.");
    return;
  }

  const filename = buildRoleFilename(markdown);

  try {
    if (!supportsDirectoryPicker()) {
      downloadMarkdown(markdown, filename);
      setStatus(`Saved ${filename} as a download.`);
      return;
    }

    saveButton.disabled = true;
    setStatus(rolesDirectoryHandle ? "Saving Markdown..." : "Choose where to save Markdown files.");

    if (!rolesDirectoryHandle) {
      rolesDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    }

    await ensureDirectoryPermission(rolesDirectoryHandle);
    const savedFilename = await writeUniqueFile(rolesDirectoryHandle, filename, markdown);
    setStatus(`Saved ${savedFilename}.`);
  } catch (error) {
    if (error.name === "AbortError") {
      setStatus("Save cancelled.");
      return;
    }

    rolesDirectoryHandle = null;
    downloadMarkdown(markdown, filename);
    setStatus(`Could not write to folder, saved ${filename} as a download instead.`);
  } finally {
    saveButton.disabled = false;
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
    throw new Error(response?.error || "Job data was not available on this page.");
  }

  return response.job;
}

function isSupportedJobUrl(url) {
  return isLinkedInJobsUrl(url) || isWellfoundJobsUrl(url) || isBigRemoteJobUrl(url) || isNotYetUnicornsJobUrl(url) || isAshbyJobUrl(url);
}

function isLinkedInJobsUrl(url) {
  return /^https:\/\/www\.linkedin\.com\/jobs\//.test(url || "");
}

function isWellfoundJobsUrl(url) {
  return /^https:\/\/wellfound\.com\/jobs(?:[/?#]|$)/.test(url || "");
}

function isBigRemoteJobUrl(url) {
  return /^https:\/\/bigremotejob\.com\/remote-jobs\//.test(url || "");
}

function isNotYetUnicornsJobUrl(url) {
  return /^https:\/\/notyetunicorns\.com\/job\//.test(url || "");
}

function isAshbyJobUrl(url) {
  return /^https:\/\/jobs\.ashbyhq\.com\/[^/?#]+\/[0-9a-f-]+\/?(?:[?#].*)?$/i.test(url || "");
}

function setStatus(message) {
  statusText.textContent = message;
}

function supportsDirectoryPicker() {
  return typeof window.showDirectoryPicker === "function";
}

async function ensureDirectoryPermission(directoryHandle) {
  const options = { mode: "readwrite" };
  const currentPermission = await directoryHandle.queryPermission(options);

  if (currentPermission === "granted") {
    return;
  }

  const requestedPermission = await directoryHandle.requestPermission(options);

  if (requestedPermission !== "granted") {
    throw new Error("Folder write permission was not granted.");
  }
}

async function writeUniqueFile(directoryHandle, preferredFilename, markdown) {
  const filename = await nextAvailableFilename(directoryHandle, preferredFilename);
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(markdown.endsWith("\n") ? markdown : `${markdown}\n`);
  await writable.close();

  return filename;
}

async function nextAvailableFilename(directoryHandle, preferredFilename) {
  const dotIndex = preferredFilename.lastIndexOf(".");
  const basename = dotIndex > 0 ? preferredFilename.slice(0, dotIndex) : preferredFilename;
  const extension = dotIndex > 0 ? preferredFilename.slice(dotIndex) : "";

  for (let index = 0; index < 100; index += 1) {
    const filename = index === 0 ? preferredFilename : `${basename}-${index + 1}${extension}`;

    try {
      await directoryHandle.getFileHandle(filename, { create: false });
    } catch (error) {
      if (error.name === "NotFoundError") {
        return filename;
      }

      throw error;
    }
  }

  throw new Error("Could not find an available filename.");
}

function downloadMarkdown(markdown, filename) {
  const blob = new Blob([markdown.endsWith("\n") ? markdown : `${markdown}\n`], {
    type: "text/markdown;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildRoleFilename(markdown) {
  const company = extractMarkdownSection(markdown, "Company");
  const role = extractMarkdownSection(markdown, "Role");
  const slug = slugify([company, role].filter(Boolean).join("-"));

  return `${slug || "job-role"}.md`;
}

function extractMarkdownSection(markdown, heading) {
  const pattern = new RegExp(`^# ${escapeRegExp(heading)}\\n([\\s\\S]*?)(?=\\n# |$)`, "m");
  const match = markdown.match(pattern);

  return match?.[1]?.trim() || "";
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
