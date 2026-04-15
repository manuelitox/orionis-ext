(() => {
  const MESSAGE_TYPE = "ORIONIS_EXTRACT_LINKEDIN_JOB";

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== MESSAGE_TYPE) {
      return false;
    }

    extractLinkedInJob()
      .then((job) => sendResponse({ ok: true, job }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  });

  async function extractLinkedInJob() {
    await expandJobDescription();

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
    const descriptionRoot = bestTextElement([
      "[componentkey^='JobDetails_AboutTheJob']",
      "[componentKey^='JobDetails_AboutTheJob']",
      "#job-details",
      ".jobs-description",
      ".jobs-description__content",
      ".jobs-box__html-content",
      ".jobs-description-content__text",
      ".description__text",
      "[class*='jobs-description'] [class*='content']",
      "[class*='jobs-box'] [class*='html-content']"
    ]);

    return cleanText(descriptionRoot?.innerText || "");
  }

  async function expandJobDescription() {
    const descriptionRoot = firstVisibleElement([
      "[componentkey^='JobDetails_AboutTheJob']",
      "[componentKey^='JobDetails_AboutTheJob']",
      ".jobs-description",
      ".jobs-description__content",
      "#job-details"
    ]);

    const expandButton = Array.from(
      document.querySelectorAll("button, [role='button']")
    ).find((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const text = cleanText(element.innerText || element.textContent || "");
      const label = cleanText(element.getAttribute("aria-label") || "");
      const combined = `${text} ${label}`;

      return (
        /show more|see more|more/i.test(combined) &&
        (!descriptionRoot || descriptionRoot.contains(element))
      );
    });

    if (expandButton) {
      expandButton.click();
      await wait(150);
    }
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

  function bestTextElement(selectors) {
    const candidates = selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector)).filter(isVisible)
    );

    return candidates
      .map((element) => ({ element, text: cleanText(element.innerText || "") }))
      .filter((candidate) => candidate.text.length > 80)
      .sort((a, b) => scoreDescriptionCandidate(b) - scoreDescriptionCandidate(a))[0]
      ?.element || null;
  }

  function scoreDescriptionCandidate(candidate) {
    const text = candidate.text.toLowerCase();
    let score = candidate.text.length;

    if (text.includes("about the job")) {
      score += 500;
    }

    if (text.includes("responsibilities") || text.includes("requirements")) {
      score += 250;
    }

    if (text.includes("show more") || text.includes("see more")) {
      score -= 100;
    }

    return score;
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
      .replace(/^\s*(show more|show less|see more|see less)\s*$/gim, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }
})();
