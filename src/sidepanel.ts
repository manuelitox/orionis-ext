import { buildOrionisMarkdown } from "./markdown.template.js";
import { buildRoleFilename, isSupportedJobUrl, unsupportedJobPageMessage } from "./sidepanel.utils.js";
import type { CapturedJob, ExtractJobMessage, ExtractJobResponse } from "./types.js";

const MESSAGE_TYPE = "ORIONIS_EXTRACT_JOB";

const markdownEditor = queryRequiredElement<HTMLTextAreaElement>("#markdown");
const statusText = queryRequiredElement<HTMLElement>("#status");
const refreshButton = queryRequiredElement<HTMLButtonElement>("#refresh");
const copyButton = queryRequiredElement<HTMLButtonElement>("#copy");
const saveButton = queryRequiredElement<HTMLButtonElement>("#save");

let rolesDirectoryHandle: FileSystemDirectoryHandle | null = null;

refreshButton.addEventListener("click", captureCurrentTab);
copyButton.addEventListener("click", copyMarkdown);
saveButton.addEventListener("click", saveRole);

captureCurrentTab();

async function captureCurrentTab(): Promise<void> {
  setStatus("Reading the current job page...");
  refreshButton.disabled = true;

  try {
    const tab = await getActiveTab();

    if (!tab?.id || !isSupportedJobUrl(tab.url)) {
      throw new Error(unsupportedJobPageMessage(tab?.url));
    }

    const job = await requestJobData(tab.id);
    markdownEditor.value = buildOrionisMarkdown(job);
    setStatus("Markdown ready. Review, copy, or save it.", "success");
  } catch (error) {
    setStatus(errorMessage(error, "Could not capture this page."), "error");
  } finally {
    refreshButton.disabled = false;
  }
}

async function copyMarkdown(): Promise<void> {
  try {
    await navigator.clipboard.writeText(markdownEditor.value);
    setStatus("Markdown copied.", "success");
  } catch (_error) {
    markdownEditor.select();
    document.execCommand("copy");
    setStatus("Markdown copied.", "success");
  }
}

async function saveRole(): Promise<void> {
  const markdown = markdownEditor.value.trim();

  if (!markdown) {
    setStatus("Nothing to save yet.", "error");
    return;
  }

  const filename = buildRoleFilename(markdown);

  try {
    if (!supportsDirectoryPicker()) {
      downloadMarkdown(markdown, filename);
      setStatus(`Saved ${filename} as a download.`, "success");
      return;
    }

    saveButton.disabled = true;
    setStatus(rolesDirectoryHandle ? "Saving Markdown..." : "Choose where to save Markdown files.");

    if (!rolesDirectoryHandle) {
      rolesDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    }

    await ensureDirectoryPermission(rolesDirectoryHandle);
    const savedFilename = await writeUniqueFile(rolesDirectoryHandle, filename, markdown);
    setStatus(`Saved ${savedFilename}.`, "success");
  } catch (error) {
    if (hasErrorName(error, "AbortError")) {
      setStatus("Save cancelled.");
      return;
    }

    rolesDirectoryHandle = null;
    downloadMarkdown(markdown, filename);
    setStatus(`Could not write to folder, saved ${filename} as a download instead.`, "error");
  } finally {
    saveButton.disabled = false;
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function requestJobData(tabId: number): Promise<CapturedJob> {
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

async function sendExtractMessage(tabId: number): Promise<CapturedJob> {
  const message: ExtractJobMessage = { type: MESSAGE_TYPE };
  const response = await chrome.tabs.sendMessage<ExtractJobMessage, ExtractJobResponse>(tabId, message);

  if (response?.ok !== true) {
    throw new Error(response?.error || "Job data was not available on this page.");
  }

  return response.job;
}

type StatusTone = "info" | "success" | "error";

function setStatus(message: string, tone: StatusTone = "info"): void {
  statusText.textContent = message;
  statusText.className = `status status-${tone}`;
}

function supportsDirectoryPicker(): boolean {
  return typeof window.showDirectoryPicker === "function";
}

async function ensureDirectoryPermission(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
  const options: FileSystemHandlePermissionDescriptor = { mode: "readwrite" };
  const currentPermission = await directoryHandle.queryPermission(options);

  if (currentPermission === "granted") {
    return;
  }

  const requestedPermission = await directoryHandle.requestPermission(options);

  if (requestedPermission !== "granted") {
    throw new Error("Folder write permission was not granted.");
  }
}

async function writeUniqueFile(
  directoryHandle: FileSystemDirectoryHandle,
  preferredFilename: string,
  markdown: string
): Promise<string> {
  const filename = await nextAvailableFilename(directoryHandle, preferredFilename);
  const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();

  await writable.write(markdown.endsWith("\n") ? markdown : `${markdown}\n`);
  await writable.close();

  return filename;
}

async function nextAvailableFilename(
  directoryHandle: FileSystemDirectoryHandle,
  preferredFilename: string
): Promise<string> {
  const dotIndex = preferredFilename.lastIndexOf(".");
  const basename = dotIndex > 0 ? preferredFilename.slice(0, dotIndex) : preferredFilename;
  const extension = dotIndex > 0 ? preferredFilename.slice(dotIndex) : "";

  for (let index = 0; index < 100; index += 1) {
    const filename = index === 0 ? preferredFilename : `${basename}-${index + 1}${extension}`;

    try {
      await directoryHandle.getFileHandle(filename, { create: false });
    } catch (error) {
      if (hasErrorName(error, "NotFoundError")) {
        return filename;
      }

      throw error;
    }
  }

  throw new Error("Could not find an available filename.");
}

function downloadMarkdown(markdown: string, filename: string): void {
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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function queryRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Required element not found: ${selector}`);
  }

  return element;
}

function hasErrorName(error: unknown, name: string): boolean {
  return error instanceof DOMException
    ? error.name === name
    : typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === name;
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
