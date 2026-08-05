import { buildOrionisMarkdown, type OrionisMarkdownDraft } from "./markdown.template.js";
import { SidePanelTranslations } from "./sidepanel.translations.js";
import { buildRoleFilename, isSupportedJobUrl, unsupportedJobPageMessage } from "./sidepanel.utils.js";
import type {
  ActiveTabMetadata,
  CapturedJob,
  ExtractJobMessage,
  ExtractJobResponse,
  GetActiveTabMetadataMessage
} from "./types.js";

const MESSAGE_TYPE = "ORIONIS_EXTRACT_JOB";
const ACTIVE_TAB_METADATA_MESSAGE_TYPE = "ORIONIS_GET_ACTIVE_TAB_METADATA";

const markdownEditor = queryRequiredElement<HTMLTextAreaElement>("#markdown");
const statusText = queryRequiredElement<HTMLElement>("#status");
const refreshButton = queryRequiredElement<HTMLButtonElement>("#refresh");
const copyButton = queryRequiredElement<HTMLButtonElement>("#copy");
const saveButton = queryRequiredElement<HTMLButtonElement>("#save");
const settingsButton = queryRequiredElement<HTMLButtonElement>("#settings");
const settingsPopover = queryRequiredElement<HTMLElement>("#settings-popover");
const languageSelect = queryRequiredElement<HTMLSelectElement>("#language");

let rolesDirectoryHandle: FileSystemDirectoryHandle | null = null;
const translations = new SidePanelTranslations(languageSelect);
const t = translations.t;
let lastProgrammaticMarkdown = "";
const invokedTab = invokedTabFromLocation();

refreshButton.addEventListener("click", captureCurrentTab);
copyButton.addEventListener("click", copyMarkdown);
saveButton.addEventListener("click", saveRole);
settingsButton.addEventListener("click", toggleSettingsPopover);
document.addEventListener("click", closeSettingsPopoverOnOutsideClick);
document.addEventListener("keydown", closeSettingsPopoverOnEscape);

initializeSidePanel();

async function initializeSidePanel(): Promise<void> {
  translations.initialize();
  await renderManualDraftForCurrentTab({ preserveEdited: false });
  captureCurrentTab();
}

function toggleSettingsPopover(): void {
  const isOpen = !settingsPopover.hasAttribute("hidden");

  setSettingsPopoverOpen(!isOpen);
}

function closeSettingsPopoverOnOutsideClick(event: MouseEvent): void {
  const target = event.target;

  if (!(target instanceof Node)) {
    return;
  }

  if (settingsPopover.contains(target) || settingsButton.contains(target)) {
    return;
  }

  setSettingsPopoverOpen(false);
}

function closeSettingsPopoverOnEscape(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    setSettingsPopoverOpen(false);
  }
}

function setSettingsPopoverOpen(isOpen: boolean): void {
  settingsPopover.toggleAttribute("hidden", !isOpen);
  settingsButton.setAttribute("aria-expanded", String(isOpen));
}

async function captureCurrentTab(): Promise<void> {
  setStatus(t("status.reading"));
  refreshButton.disabled = true;

  try {
    const tab = await getActiveTab();

    if (!tab?.id || (tab.url && !isSupportedJobUrl(tab.url))) {
      renderManualDraftForTab(tab, {
        preserveEdited: true,
        statusMessage: unsupportedStatusMessage(tab?.url)
      });
      return;
    }

    const job = await requestJobData(tab.id);

    if (isEditorDirty() && !window.confirm(t("confirm.replaceEditedDraft"))) {
      setStatus(t("status.editedDraftKept"));
      return;
    }

    setMarkdown(buildOrionisMarkdown(job));
    setStatus(t("status.markdownReady"), "success");
  } catch (error) {
    const errorMessage = translations.localizedErrorMessage(error, t("status.captureFailed"));

    setStatus(`${errorMessage} ${t("status.editedDraftKept")}`, "error");
  } finally {
    refreshButton.disabled = false;
  }
}

async function renderManualDraftForCurrentTab(options: { preserveEdited: boolean }): Promise<void> {
  renderManualDraftForTab(await getActiveTab(), options);
}

function renderManualDraftForTab(tab: ActiveTabMetadata | undefined, options: { preserveEdited: boolean; statusMessage?: string }): void {
  if (options.preserveEdited && isEditorDirty()) {
    setStatus(t("status.editedDraftKept"));
    return;
  }

  setMarkdown(buildOrionisMarkdown(buildManualDraft(tab?.url)));
  setStatus(options.statusMessage || t("status.manualDraftReady"), options.statusMessage ? "error" : "success");
}

function unsupportedStatusMessage(url: string | undefined): string | undefined {
  const messages = translations.unsupportedJobPageMessages();
  const message = unsupportedJobPageMessage(url, messages);

  return message === messages.generic ? undefined : message;
}

function buildManualDraft(url: string | undefined): OrionisMarkdownDraft {
  return {
    source: sourceFromUrl(url),
    captured_at: new Date().toISOString(),
    title: "",
    company: "",
    website: "",
    salary: "",
    description: "",
    url: url || ""
  };
}

function sourceFromUrl(url: string | undefined): string {
  try {
    return new URL(url || "").hostname;
  } catch (_error) {
    return "";
  }
}

function setMarkdown(markdown: string): void {
  markdownEditor.value = markdown;
  lastProgrammaticMarkdown = markdown;
}

function isEditorDirty(): boolean {
  return markdownEditor.value !== lastProgrammaticMarkdown;
}

async function copyMarkdown(): Promise<void> {
  try {
    await navigator.clipboard.writeText(markdownEditor.value);
    setStatus(t("status.copied"), "success");
  } catch (_error) {
    markdownEditor.select();
    document.execCommand("copy");
    setStatus(t("status.copied"), "success");
  }
}

async function saveRole(): Promise<void> {
  const markdown = markdownEditor.value.trim();

  if (!markdown) {
    setStatus(t("status.emptySave"), "error");
    return;
  }

  const filename = buildRoleFilename(markdown);

  try {
    if (!supportsDirectoryPicker()) {
      downloadMarkdown(markdown, filename);
      setStatus(t("status.savedDownload", { filename }), "success");
      return;
    }

    saveButton.disabled = true;
    setStatus(rolesDirectoryHandle ? t("status.saving") : t("status.chooseFolder"));

    if (!rolesDirectoryHandle) {
      rolesDirectoryHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    }

    await ensureDirectoryPermission(rolesDirectoryHandle);
    const savedFilename = await writeUniqueFile(rolesDirectoryHandle, filename, markdown);
    setStatus(t("status.savedFile", { filename: savedFilename }), "success");
  } catch (error) {
    if (hasErrorName(error, "AbortError")) {
      setStatus(t("status.saveCancelled"));
      return;
    }

    rolesDirectoryHandle = null;
    downloadMarkdown(markdown, filename);
    setStatus(t("status.folderFallback", { filename }), "error");
  } finally {
    saveButton.disabled = false;
  }
}

async function getActiveTab(): Promise<ActiveTabMetadata | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.url && !isExtensionPageUrl(tab.url)) {
    return { id: tab.id, url: tab.url };
  }

  if (invokedTab) {
    return invokedTab;
  }

  const actionTab = await requestActiveTabMetadata();

  if (actionTab?.url || actionTab?.id) {
    return actionTab;
  }

  return tab ? { id: tab.id, url: tab.url } : undefined;
}

async function requestActiveTabMetadata(): Promise<ActiveTabMetadata | undefined> {
  const message: GetActiveTabMetadataMessage = { type: ACTIVE_TAB_METADATA_MESSAGE_TYPE };

  try {
    return await chrome.runtime.sendMessage<GetActiveTabMetadataMessage, ActiveTabMetadata>(message);
  } catch (_error) {
    return undefined;
  }
}

function invokedTabFromLocation(): ActiveTabMetadata | undefined {
  const params = new URLSearchParams(window.location.search);
  const rawTabId = params.get("tabId");
  const tabId = rawTabId ? Number(rawTabId) : NaN;
  const url = params.get("url") || undefined;

  if (!Number.isInteger(tabId) && !url) {
    return undefined;
  }

  return {
    id: Number.isInteger(tabId) ? tabId : undefined,
    url
  };
}

function isExtensionPageUrl(url: string): boolean {
  return url.startsWith(`chrome-extension://${chrome.runtime.id}/`);
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
    throw new Error(response?.error || t("errors.jobDataUnavailable"));
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
    throw new Error(t("errors.folderPermissionDenied"));
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

  throw new Error(t("errors.noFilenameAvailable"));
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
