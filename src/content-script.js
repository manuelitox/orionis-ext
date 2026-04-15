(() => {
  const MESSAGE_TYPE = "ORIONIS_EXTRACT_LINKEDIN_JOB";

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== MESSAGE_TYPE) {
      return false;
    }

    sendResponse({ ok: true, job: extractLinkedInJob() });
    return true;
  });

  function extractLinkedInJob() {
    return {
      title: getJobTitle(),
      company: getCompanyName(),
      url: window.location.href,
      description: getJobDescription()
    };
  }

  function getJobTitle() {
    return (
      textFromFirst([
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        ".jobs-details-top-card__job-title",
        "[data-test-job-title]",
        "h1"
      ]) || parseTitleFromDocument()
    );
  }

  function getCompanyName() {
    return (
      textFromFirst([
        ".job-details-jobs-unified-top-card__company-name a",
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name a",
        ".jobs-unified-top-card__company-name",
        ".jobs-details-top-card__company-url",
        "[data-test-job-company-name]"
      ]) || parseCompanyFromDocument()
    );
  }

  function getJobDescription() {
    const descriptionRoot = firstVisibleElement([
      "#job-details",
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".jobs-description-content__text",
      ".description__text"
    ]);

    return cleanText(descriptionRoot?.innerText || "");
  }

  function textFromFirst(selectors) {
    const element = firstVisibleElement(selectors);
    return cleanText(element?.innerText || element?.textContent || "");
  }

  function firstVisibleElement(selectors) {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const visible = elements.find(isVisible);
      if (visible) {
        return visible;
      }
    }

    return null;
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  function parseTitleFromDocument() {
    const [title] = document.title.split("|").map((part) => part.trim());
    return cleanText(title || "");
  }

  function parseCompanyFromDocument() {
    const parts = document.title.split("|").map((part) => part.trim());
    const linkedinIndex = parts.findIndex((part) => /linkedin/i.test(part));
    const candidate = linkedinIndex > 0 ? parts[linkedinIndex - 1] : "";

    return cleanText(candidate);
  }

  function cleanText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
})();
