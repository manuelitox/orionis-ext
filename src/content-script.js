(() => {
  const MESSAGE_TYPE = "ORIONIS_EXTRACT_JOB";

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== MESSAGE_TYPE) {
      return false;
    }

    extractJob()
      .then((job) => sendResponse({ ok: true, job }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  });

  async function extractJob() {
    if (isLinkedInJobPage()) {
      await expandLinkedInJobDescription();

      return {
        title: getLinkedInJobTitle(),
        company: getLinkedInCompanyName(),
        website: getLinkedInCompanyWebsite(),
        salary: getLinkedInSalary(),
        url: window.location.href,
        description: getLinkedInJobDescription()
      };
    }

    if (isWellfoundJobPage()) {
      await expandWellfoundJobDescription();

      return {
        title: getWellfoundJobTitle(),
        company: getWellfoundCompanyName(),
        website: getWellfoundCompanyWebsite(),
        salary: getWellfoundSalary(),
        url: window.location.href,
        description: getWellfoundJobDescription()
      };
    }

    if (isBigRemoteJobPage()) {
      const job = {
        title: getBigRemoteJobTitle(),
        company: getBigRemoteJobCompanyName(),
        website: getBigRemoteJobCompanyWebsite(),
        salary: getBigRemoteJobSalary(),
        url: window.location.href,
        description: getBigRemoteJobDescription()
      };

      if (!job.title && !job.company && !job.description) {
        throw new Error("BigRemoteJob page detected, but no job fields were found. Reload the unpacked extension in Brave and refresh this job page.");
      }

      if (!job.description) {
        throw new Error("BigRemoteJob page detected, but the JD body was empty. Refresh the job page, then click Refresh in Orionis Capture.");
      }

      return job;
    }

    if (isNotYetUnicornsJobPage()) {
      const job = {
        title: getNotYetUnicornsJobTitle(),
        company: getNotYetUnicornsCompanyName(),
        website: getNotYetUnicornsCompanyWebsite(),
        salary: getNotYetUnicornsSalary(),
        url: window.location.href,
        description: getNotYetUnicornsJobDescription()
      };

      if (!job.title && !job.company && !job.description) {
        throw new Error("Not Yet Unicorns page detected, but no job fields were found. Reload the unpacked extension in Brave and refresh this job page.");
      }

      if (!job.description) {
        throw new Error("Not Yet Unicorns page detected, but the JD body was empty. Refresh the job page, then click Refresh in Orionis Capture.");
      }

      return job;
    }

    throw new Error("This page is not a supported job posting.");
  }

  function isLinkedInJobPage() {
    return /^https:\/\/www\.linkedin\.com\/jobs\//.test(window.location.href);
  }

  function isWellfoundJobPage() {
    return /^https:\/\/wellfound\.com\/jobs(\/|$)/.test(window.location.href);
  }

  function isBigRemoteJobPage() {
    return /^https:\/\/bigremotejob\.com\/remote-jobs\//.test(window.location.href);
  }

  function isNotYetUnicornsJobPage() {
    return /^https:\/\/notyetunicorns\.com\/job\//.test(window.location.href);
  }

  function getLinkedInJobTitle() {
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

  function getLinkedInCompanyName() {
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

  function getLinkedInJobDescription() {
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

  function getLinkedInCompanyWebsite() {
    return (
      hrefFromFirst([
        "a[href*='/company/'][target='_blank']",
        "a[data-tracking-control-name*='company_website']",
        "a[href^='http']"
      ], isExternalWebsiteHref) || ""
    );
  }

  function getLinkedInSalary() {
    const pageText = cleanText(document.body?.innerText || "");
    return normalizeSalary(firstSalaryMatch(pageText));
  }

  async function expandLinkedInJobDescription() {
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

  function getWellfoundJobTitle() {
    return (
      textFromFirst([
        "main h1",
        "article h1",
        "[data-test] h1",
        "h1"
      ]) || parseWellfoundTitleFromDocument()
    );
  }

  function getWellfoundCompanyName() {
    return (
      textFromFirst([
        "main a[href^='/company/']",
        "main a[href*='wellfound.com/company/']",
        "article a[href^='/company/']",
        "article a[href*='wellfound.com/company/']"
      ]) || parseWellfoundCompanyFromDocument()
    );
  }

  function getWellfoundCompanyWebsite() {
    const websiteLink = Array.from(document.querySelectorAll("a[href]")).find((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const text = cleanText(element.innerText || element.textContent || "");
      const href = element.href || "";

      return /visit our site|company website|website/i.test(text) && isExternalWebsiteHref(href);
    });

    if (websiteLink?.href) {
      return websiteLink.href;
    }

    return (
      hrefFromFirst([
        "main a[href^='http']",
        "article a[href^='http']"
      ], isExternalWebsiteHref) || ""
    );
  }

  function getWellfoundSalary() {
    const directSalary = textFromFirst([
      ".styles_subheader__DfKjh",
      "[class^='styles_subheader__']",
      "[class*=' styles_subheader__']"
    ]);

    if (directSalary && /[$€£₹]/.test(directSalary)) {
      return normalizeSalary(directSalary);
    }

    const headerText = cleanText(
      firstVisibleElement(["main", "article", "[role='main']"])?.innerText || ""
    );

    return normalizeSalary(
      firstSalaryMatch(headerText) || firstSalaryMatch(cleanText(document.body?.innerText || ""))
    );
  }

  function getWellfoundJobDescription() {
    const directDescription = textFromFirst([
      ".styles_body__k1Fvd",
      "[class^='styles_body__']",
      "[class*=' styles_body__']"
    ]);

    if (directDescription) {
      return stripWellfoundBoilerplate(directDescription);
    }

    const pageText = cleanText(document.body?.innerText || "");
    const extractedSection = extractWellfoundDescription(pageText);

    if (extractedSection) {
      return stripWellfoundBoilerplate(extractedSection);
    }

    const descriptionRoot = bestTextElement([
      "main",
      "article",
      "[role='main']"
    ]);

    return stripWellfoundBoilerplate(cleanText(descriptionRoot?.innerText || ""));
  }

  async function expandWellfoundJobDescription() {
    const aboutHeading = findHeadingElement(/about the job/i);
    const expandButton = Array.from(
      document.querySelectorAll("button, [role='button']")
    ).find((element) => {
      if (!isVisible(element)) {
        return false;
      }

      const text = cleanText(element.innerText || element.textContent || "");
      const label = cleanText(element.getAttribute("aria-label") || "");
      const combined = `${text} ${label}`;

      return /\b(show more|see more|read more)\b/i.test(combined);
    });

    if (expandButton && (!aboutHeading || distanceToElement(expandButton, aboutHeading) < 1200)) {
      expandButton.click();
      await wait(150);
    }
  }

  function getBigRemoteJobTitle() {
    return (
      textFromFirst([
        "h1.bde-heading",
        ".section-container h1",
        "article h1",
        "main h1",
        "h1"
      ]) || parseBigRemoteJobTitleFromDocument()
    );
  }

  function getBigRemoteJobCompanyName() {
    return (
      textFromFirst([
        ".bde-post-meta-50-168 .ee-postmeta-author",
        ".ee-postmeta-author",
        ".pp-multiple-authors-boxes-name a",
        "[rel='author']"
      ]) || parseBigRemoteJobMetaField("Company") || parseBigRemoteJobCompanyFromDocument()
    );
  }

  function getBigRemoteJobCompanyWebsite() {
    return (
      hrefFromFirst([
        ".ppma-author-user_url-profile-data[href]",
        "a[aria-label='Website'][href]",
        ".pp-author-boxes-avatar-details a[href^='http']"
      ], isExternalWebsiteHref) || ""
    );
  }

  function getBigRemoteJobSalary() {
    const visibleSalary = textFromFirst([
      ".bde-post-meta-50-174 .ee-postmeta-term",
      ".ee-postmeta-term"
    ]);

    if (visibleSalary && /[$€£₹]/.test(visibleSalary)) {
      return normalizeSalary(visibleSalary);
    }

    return normalizeSalary(parseBigRemoteJobMetaField("Salary") || firstSalaryMatch(cleanText(document.body?.innerText || "")));
  }

  function getBigRemoteJobDescription() {
    const directDescription = cleanText(bigRemoteJobDescriptionElement()?.innerText || "");

    if (directDescription) {
      return stripBigRemoteJobBoilerplate(directDescription);
    }

    const pageText = cleanText(document.body?.innerText || "");
    return stripBigRemoteJobBoilerplate(
      extractBigRemoteJobDescription(pageText) ||
      cleanText(bestTextElement(["article", "main", ".section-container"])?.innerText || "")
    );
  }

  function bigRemoteJobDescriptionElement() {
    const directElement = firstVisibleElement([".bde-rich-text-50-105"]);

    if (directElement) {
      return directElement;
    }

    return Array.from(document.querySelectorAll(".breakdance-rich-text-styles, [class*='rich-text']"))
      .filter(isVisible)
      .map((element) => ({ element, text: cleanText(element.innerText || element.textContent || "") }))
      .filter((candidate) => /who we are|your team and role|about you|compensation|hiring process/i.test(candidate.text))
      .sort((a, b) => b.text.length - a.text.length)[0]?.element || null;
  }

  function getNotYetUnicornsJobTitle() {
    const nextData = getNotYetUnicornsNextData();
    const schema = getNotYetUnicornsJobPostingSchema();

    return cleanText(
      nextData?.job?.role_title ||
      schema?.title ||
      textFromFirst([
        "[class*='JobDetailHeader'][class*='jobTitle']",
        "header h1",
        "main h1",
        "h1"
      ]) ||
      parseNotYetUnicornsTitleFromDocument()
    );
  }

  function getNotYetUnicornsCompanyName() {
    const nextData = getNotYetUnicornsNextData();
    const schema = getNotYetUnicornsJobPostingSchema();

    return cleanText(
      nextData?.job?.company_name ||
      nextData?.company?.name ||
      schema?.hiringOrganization?.name ||
      textFromFirst([
        "[class*='JobDetailHeader'][class*='companyName'] a",
        "a[href^='/company/']"
      ]) ||
      parseNotYetUnicornsCompanyFromDocument()
    );
  }

  function getNotYetUnicornsCompanyWebsite() {
    const nextData = getNotYetUnicornsNextData();
    const schema = getNotYetUnicornsJobPostingSchema();

    return (
      cleanText(nextData?.company?.website_url || schema?.hiringOrganization?.sameAs || "") ||
      hrefFromFirst([
        "a[class*='companyLink'][href^='http']",
        "a[title='Visit website'][href^='http']",
        "aside a[href^='http']",
        "header a[href^='http']"
      ], isExternalWebsiteHref) ||
      ""
    );
  }

  function getNotYetUnicornsSalary() {
    const nextData = getNotYetUnicornsNextData();
    const schema = getNotYetUnicornsJobPostingSchema();
    const salaryRange = cleanText(nextData?.job?.salary_range || "");

    if (salaryRange) {
      return normalizeSalary(salaryRange);
    }

    const schemaSalary = formatNotYetUnicornsSchemaSalary(schema?.baseSalary);
    if (schemaSalary) {
      return normalizeSalary(schemaSalary);
    }

    return normalizeSalary(
      textFromFirst(["[class*='JobDetailHeader'][class*='salary']"]) ||
      firstSalaryMatch(cleanText(document.body?.innerText || ""))
    );
  }

  function getNotYetUnicornsJobDescription() {
    const nextData = getNotYetUnicornsNextData();
    const schema = getNotYetUnicornsJobPostingSchema();

    return cleanText(
      nextData?.job?.description ||
      schema?.description ||
      textFromFirst([
        "[class*='JobDescription'][class*='content']",
        "section[class*='JobDescription']"
      ]) ||
      extractNotYetUnicornsDescription(cleanText(document.body?.innerText || ""))
    );
  }

  function textFromFirst(selectors) {
    const element = firstVisibleElement(selectors);
    return cleanText(element?.innerText || element?.textContent || "");
  }

  function hrefFromFirst(selectors, predicate = () => true) {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll(selector));
      const visible = elements.find((element) => isVisible(element) && predicate(element.href || ""));
      if (visible?.href) {
        return visible.href;
      }
    }

    return "";
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

  function parseWellfoundTitleFromDocument() {
    const title = document.title.split("•")[0]?.trim() || document.title;
    return cleanText(title.replace(/\s+\|\s+Wellfound$/i, ""));
  }

  function parseCompanyFromDocument() {
    const parts = document.title.split("|").map((part) => part.trim());
    const linkedinIndex = parts.findIndex((part) => /linkedin/i.test(part));
    const candidate = linkedinIndex > 0 ? parts[linkedinIndex - 1] : "";

    return cleanText(candidate);
  }

  function parseWellfoundCompanyFromDocument() {
    const primaryTitle = document.title.split("•")[0]?.trim() || document.title;
    const atIndex = primaryTitle.lastIndexOf(" at ");

    if (atIndex > -1) {
      return cleanText(primaryTitle.slice(atIndex + 4));
    }

    const byBullet = document.title.split("•").map((part) => cleanText(part));
    return cleanText(byBullet[1] || "");
  }

  function parseBigRemoteJobTitleFromDocument() {
    const title = document.title.replace(/^Remote\s+/i, "").replace(/\s+at\s+.+$/i, "");
    return cleanText(title);
  }

  function parseBigRemoteJobCompanyFromDocument() {
    const match = document.title.match(/\s+at\s+(.+)$/i);
    return cleanText(match?.[1] || "");
  }

  function parseNotYetUnicornsTitleFromDocument() {
    const title = document.title.split("|")[0]?.trim() || document.title;
    return cleanText(title.replace(/\s+at\s+.+$/i, ""));
  }

  function parseNotYetUnicornsCompanyFromDocument() {
    const match = document.title.match(/\s+at\s+(.+?)\s*(?:\||$)/i);
    return cleanText(match?.[1] || "");
  }

  function parseBigRemoteJobMetaField(label) {
    const description = cleanText(
      document.querySelector("meta[property='og:description']")?.content ||
      document.querySelector("meta[name='description']")?.content ||
      ""
    );
    const pattern = new RegExp(`${escapeRegExp(label)}:\\s*([^🪛🌎💸🚀🔥]+)`, "i");
    const match = description.match(pattern);

    return cleanText(match?.[1] || "");
  }

  function findHeadingElement(pattern) {
    return Array.from(
      document.querySelectorAll("h1, h2, h3, h4, [role='heading']")
    ).find((element) => isVisible(element) && pattern.test(cleanText(element.innerText)));
  }

  function collectSectionText(heading) {
    const chunks = [];
    let current = heading.nextElementSibling;

    while (current) {
      if (isHeading(current) && current !== heading) {
        break;
      }

      const text = cleanText(current.innerText || current.textContent || "");
      if (text) {
        chunks.push(text);
      }

      current = current.nextElementSibling;
    }

    return cleanText(chunks.join("\n\n"));
  }

  function isHeading(element) {
    return /^(H1|H2|H3|H4|H5|H6)$/.test(element.tagName) || element.getAttribute("role") === "heading";
  }

  function stripWellfoundBoilerplate(text) {
    return cleanText(
      text
        .replace(/^about the job\s*/i, "")
        .replace(/^job description\s*/i, "")
        .replace(/\n?about the company[\s\S]*$/i, "")
        .replace(/\n?learn more about .+$/i, "")
        .replace(/\n?(apply now|save)\s*$/gim, "")
    );
  }

  function stripBigRemoteJobBoilerplate(text) {
    return cleanText(
      text
        .replace(/\n?apply for this position[\s\S]*$/i, "")
        .replace(/\n?this job was posted via[\s\S]*$/i, "")
        .replace(/\n?please mention bigremotejob[\s\S]*$/i, "")
        .replace(/\n?related jobs:[\s\S]*$/i, "")
        .replace(/\n?website:\s*https?:\/\/\S+[\s\S]*$/i, "")
    );
  }

  function extractWellfoundDescription(text) {
    return (
      extractTextBetween(text, /about the job/i, wellfoundDescriptionEndPatterns()) ||
      extractTextBetween(text, /job description/i, wellfoundDescriptionEndPatterns()) ||
      extractTextBetween(text, /the role/i, wellfoundDescriptionEndPatterns()) ||
      ""
    );
  }

  function extractBigRemoteJobDescription(text) {
    return (
      extractTextBetween(text, /who we are|job description|about the role|your team and role/i, bigRemoteJobDescriptionEndPatterns()) ||
      ""
    );
  }

  function extractNotYetUnicornsDescription(text) {
    return (
      extractTextBetween(text, /about us|job description|the role/i, notYetUnicornsDescriptionEndPatterns()) ||
      ""
    );
  }

  function extractTextBetween(text, startPattern, endPatterns) {
    const lines = String(text || "")
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);

    const startIndex = lines.findIndex((line) => startPattern.test(line));
    if (startIndex === -1) {
      return "";
    }

    let endIndex = lines.length;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      if (endPatterns.some((pattern) => pattern.test(lines[index]))) {
        endIndex = index;
        break;
      }
    }

    return cleanText(lines.slice(startIndex + 1, endIndex).join("\n"));
  }

  function wellfoundDescriptionEndPatterns() {
    return [
      /about the company/i,
      /similar jobs/i,
      /explore other opportunities/i,
      /find jobs, recruit talent, or learn about our company/i,
      /^apply now$/i
    ];
  }

  function bigRemoteJobDescriptionEndPatterns() {
    return [
      /^apply for this position$/i,
      /^related jobs:?$/i,
      /^website:\s*https?:\/\//i,
      /^hq location:/i,
      /^established:/i,
      /^company size:/i
    ];
  }

  function notYetUnicornsDescriptionEndPatterns() {
    return [
      /^apply now$/i,
      /^browse all jobs$/i,
      /^about\s+.+$/i,
      /^location$/i,
      /^work style$/i,
      /^tech stack$/i,
      /^industry$/i
    ];
  }

  function getNotYetUnicornsNextData() {
    const root = parseJsonScript("#__NEXT_DATA__");
    return root?.props?.pageProps?.jobData || null;
  }

  function getNotYetUnicornsJobPostingSchema() {
    const schemas = Array.from(document.querySelectorAll("script[type='application/ld+json']"))
      .map((element) => parseJsonValue(element.textContent))
      .filter(Boolean);

    return schemas
      .flatMap((schema) => Array.isArray(schema) ? schema : [schema])
      .find((schema) => schema?.["@type"] === "JobPosting") || null;
  }

  function parseJsonScript(selector) {
    return parseJsonValue(document.querySelector(selector)?.textContent || "");
  }

  function parseJsonValue(value) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  function formatNotYetUnicornsSchemaSalary(baseSalary) {
    const value = baseSalary?.value;
    const currencySymbol = salaryCurrencySymbol(baseSalary?.currency);

    if (!value) {
      return "";
    }

    if (value.minValue && value.maxValue) {
      return `${currencySymbol}${formatCompactSalaryNumber(value.minValue)}-${currencySymbol}${formatCompactSalaryNumber(value.maxValue)}`;
    }

    if (value.value) {
      return `${currencySymbol}${formatCompactSalaryNumber(value.value)}`;
    }

    return "";
  }

  function salaryCurrencySymbol(currency) {
    const symbols = {
      GBP: "£",
      USD: "$",
      EUR: "€"
    };

    return symbols[currency] || cleanText(currency || "");
  }

  function formatCompactSalaryNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return cleanText(value || "");
    }

    if (number >= 1000 && number % 1000 === 0) {
      return `${number / 1000}k`;
    }

    return String(number);
  }

  function firstSalaryMatch(text) {
    const matches = String(text || "").match(
      /(?:[$€£₹]\s?\d[\d.,]*\s?[kKmM]?(?:\s*[–-]\s*[$€£₹]?\s?\d[\d.,]*\s?[kKmM]?)?(?:\s*•\s*(?:no equity|[\d.,]+%\s*[–-]\s*[\d.,]+%))?)/i
    );

    return cleanText(matches?.[0] || "");
  }

  function normalizeSalary(value) {
    const salary = cleanText(value || "");

    if (!salary) {
      return "";
    }

    const numericTokens = Array.from(
      salary.matchAll(/\d[\d.,]*/g),
      (match) => Number.parseFloat(match[0].replace(/,/g, ""))
    ).filter((number) => Number.isFinite(number));

    if (numericTokens.length > 0 && numericTokens.every((number) => number === 0)) {
      return "";
    }

    return salary;
  }

  function isExternalWebsiteHref(href) {
    return Boolean(
      href &&
      /^https?:\/\//.test(href) &&
      !/linkedin\.com|wellfound\.com|bigremotejob\.com|notyetunicorns\.com/.test(href)
    );
  }

  function distanceToElement(first, second) {
    return Math.abs(first.getBoundingClientRect().top - second.getBoundingClientRect().top);
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

  function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }
})();
