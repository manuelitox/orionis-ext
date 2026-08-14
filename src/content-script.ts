import type { CapturedJob, ExtractedJobFields, JobSource } from "./content-script.types.js";

  const MESSAGE_TYPE = "ORIONIS_EXTRACT_JOB";

  const JOB_SOURCES: JobSource[] = [
    {
      source: "linkedIn",
      urlPattern: /^https:\/\/www\.linkedin\.com\/jobs\//,
      beforeExtract: expandLinkedInJobDescription,
      fields: {
        title: getLinkedInJobTitle,
        company: getLinkedInCompanyName,
        website: getLinkedInCompanyWebsite,
        salary: getLinkedInSalary,
        description: getLinkedInJobDescription
      }
    },
    {
      source: "wellfound",
      urlPattern: /^https:\/\/wellfound\.com\/jobs\/[^/?#]+\/?(?:[?#].*)?$/,
      beforeExtract: expandWellfoundJobDescription,
      fields: {
        title: getWellfoundJobTitle,
        company: getWellfoundCompanyName,
        website: getWellfoundCompanyWebsite,
        salary: getWellfoundSalary,
        description: getWellfoundJobDescription
      }
    },
    {
      source: "bigRemoteJob",
      urlPattern: /^https:\/\/bigremotejob\.com\/remote-jobs\//,
      fields: {
        title: getBigRemoteJobTitle,
        company: getBigRemoteJobCompanyName,
        website: getBigRemoteJobCompanyWebsite,
        salary: getBigRemoteJobSalary,
        description: getBigRemoteJobDescription
      }
    },
    {
      source: "notYetUnicorns",
      urlPattern: /^https:\/\/notyetunicorns\.com\/job\//,
      fields: {
        title: getNotYetUnicornsJobTitle,
        company: getNotYetUnicornsCompanyName,
        website: getNotYetUnicornsCompanyWebsite,
        salary: getNotYetUnicornsSalary,
        description: getNotYetUnicornsJobDescription
      }
    },
    {
      source: "ashby",
      urlPattern: /^https:\/\/jobs\.ashbyhq\.com\/[^/?#]+\/[0-9a-f-]+\/?(?:[?#].*)?$/i,
      fields: {
        title: getAshbyJobTitle,
        company: getAshbyCompanyName,
        website: getAshbyCompanyWebsite,
        salary: getAshbySalary,
        description: getAshbyJobDescription
      }
    },
    {
      source: "yCombinator",
      urlPattern: /^https:\/\/(?:www\.workatastartup\.com\/jobs\/\d+|www\.ycombinator\.com\/companies\/[^/?#]+\/jobs\/[^/?#]+)\/?(?:[?#].*)?$/i,
      fields: {
        title: getYCombinatorJobTitle,
        company: getYCombinatorCompanyName,
        website: getYCombinatorCompanyWebsite,
        salary: getYCombinatorSalary,
        description: getYCombinatorJobDescription
      }
    }
  ];

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== MESSAGE_TYPE) {
      return false;
    }

    extractJob()
      .then((job) => sendResponse({ ok: true, job }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));

    return true;
  });
  }

  export async function extractJob() {
    const jobSource = findJobSource(window.location.href);

    if (!jobSource) {
      throw new Error("This page is not a supported job posting.");
    }

    await jobSource.beforeExtract?.();

    const job = buildJob(jobSource);

    validateCapturedJobContract(job);

    return job;
  }

  function buildJob(jobSource: JobSource): CapturedJob {
    return {
      ...buildCaptureMetadata(jobSource.source),
      ...extractJobFields(jobSource.fields),
      url: window.location.href
    };
  }

  function extractJobFields(fields: JobSource["fields"]): ExtractedJobFields {
    return Object.fromEntries(
      Object.entries(fields).map(([name, getValue]) => [name, getValue()])
    ) as ExtractedJobFields;
  }

  export function validateCapturedJobContract(job: CapturedJob): void {
    if (!job.title && !job.company && !job.description) {
      throw new Error(captureReadinessMessage(job, "no_fields"));
    }

    if (!job.title) {
      throw new Error(captureReadinessMessage(job, "missing_title"));
    }

    if (!job.description) {
      throw new Error(captureReadinessMessage(job, "missing_description"));
    }

    if (!job.company) {
      throw new Error(captureReadinessMessage(job, "missing_company"));
    }
  }

  export function validateBigRemoteJob(job: CapturedJob): void {
    validateCapturedJobContract(job);
  }

  export function validateNotYetUnicornsJob(job: CapturedJob): void {
    validateCapturedJobContract(job);
  }

  export function validateAshbyJob(job: CapturedJob): void {
    validateCapturedJobContract(job);
  }

  type ContractFailureReason = "no_fields" | "missing_title" | "missing_company" | "missing_description";

  function captureReadinessMessage(job: CapturedJob, reason: ContractFailureReason): string {
    const sourceName = jobSourceLabel(job.source);
    const sourcePrefix = `${sourceName} page detected, but`;

    if (isKnownListPage(job)) {
      return `${sourceName} jobs list detected. Open a specific job detail page before capturing.`;
    }

    if (reason === "no_fields") {
      return `${sourcePrefix} no job fields were found. Open a specific job detail page, wait for it to finish loading, then click Refresh in Orionis Capture.`;
    }

    if (reason === "missing_title") {
      return `${sourcePrefix} the role title was not found. Open the job detail page and wait for the full posting to load before capturing.`;
    }

    if (reason === "missing_company") {
      return `${sourcePrefix} the company name was not found. Open the job detail page and wait for the full posting to load before capturing.`;
    }

    return `${sourcePrefix} the JD body was empty. Expand the full description if needed, wait for the page to finish loading, then click Refresh in Orionis Capture.`;
  }

  function isKnownListPage(job: CapturedJob): boolean {
    try {
      return job.source === "linkedIn" && /\/jobs\/(?:search|collections|recommended)\b/i.test(new URL(job.url).pathname);
    } catch (_error) {
      return false;
    }
  }

  function jobSourceLabel(source: string): string {
    const labels: Record<string, string> = {
      ashby: "Ashby",
      bigRemoteJob: "BigRemoteJob",
      linkedIn: "LinkedIn",
      notYetUnicorns: "Not Yet Unicorns",
      yCombinator: "Y Combinator",
      wellfound: "Wellfound"
    };

    return labels[source] || "Job";
  }

  export function buildCaptureMetadata(source: string): Pick<CapturedJob, "source" | "captured_at"> {
    return {
      source,
      captured_at: new Date().toISOString()
    };
  }

  export function findJobSource(url: string): JobSource | undefined {
    return JOB_SOURCES.find((jobSource) => jobSource.urlPattern.test(url || ""));
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

  export async function expandLinkedInJobDescription() {
    const descriptionRoot = firstVisibleElement([
      "[componentkey^='JobDetails_AboutTheJob']",
      "[componentKey^='JobDetails_AboutTheJob']",
      ".jobs-description",
      ".jobs-description__content",
      "#job-details"
    ]);

    const expandButton = Array.from(
      document.querySelectorAll<HTMLElement>("button, [role='button']")
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
      textFromBestWellfoundCompanyLink() ||
      parseWellfoundCompanyFromMetadata() ||
      parseWellfoundCompanyFromCompanyHref() ||
      parseWellfoundCompanyNearTitle() ||
      parseWellfoundCompanyFromDocument()
    );
  }

  function textFromBestWellfoundCompanyLink() {
    const candidates = Array.from(
      document.querySelectorAll<HTMLAnchorElement>([
        "main a[href^='/company/']",
        "main a[href*='wellfound.com/company/']",
        "article a[href^='/company/']",
        "article a[href*='wellfound.com/company/']",
        "a[href^='/company/']",
        "a[href*='wellfound.com/company/']"
      ].join(", "))
    )
      .filter(isVisible)
      .map((element) => cleanText(element.innerText || element.textContent || ""))
      .filter((text) => text && text.length <= 80 && !/^(company|view company|profile|apply|save)$/i.test(text));

    return candidates[0] || "";
  }

  function parseWellfoundCompanyFromCompanyHref() {
    const companyLink = Array.from(
      document.querySelectorAll<HTMLAnchorElement>("a[href^='/company/'], a[href*='wellfound.com/company/']")
    ).find((element) => isVisible(element) && wellfoundCompanySlugFromHref(element.href));

    return titleCaseSlug(wellfoundCompanySlugFromHref(companyLink?.href || ""));
  }

  function parseWellfoundCompanyNearTitle() {
    const title = getWellfoundJobTitle();
    if (!title) {
      return "";
    }

    const lines = cleanText(document.body?.innerText || "")
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);
    const titleIndex = lines.findIndex((line) => line === title);

    if (titleIndex === -1) {
      return "";
    }

    for (let index = titleIndex - 1; index >= Math.max(0, titleIndex - 10); index -= 1) {
      const line = lines[index];

      if (isLikelyWellfoundCompanyLine(line)) {
        return line;
      }
    }

    return "";
  }

  function isLikelyWellfoundCompanyLine(line) {
    return Boolean(
      line &&
      line.length <= 80 &&
      !/^(act(ive)?ly hiring|save|apply|apply now|full-time|part-time|contract|internship|remote|onsite|hybrid)$/i.test(line) &&
      !/\d+\s*(?:year|month|week|day)s?\s*(?:of exp|ago)?/i.test(line) &&
      !/[$€£₹]\s?\d/.test(line)
    );
  }

  function getWellfoundCompanyWebsite() {
    const websiteLink = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]")).find((element) => {
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

    if (isWellfoundSalaryCandidate(directSalary)) {
      return normalizeSalary(firstSalaryMatch(directSalary));
    }

    const headerText = cleanText(
      firstVisibleElement(["main", "article", "[role='main']"])?.innerText || ""
    );

    return normalizeSalary(
      bestWellfoundSalaryMatch(textAroundWellfoundTitle()) ||
      bestWellfoundSalaryMatch(headerText) ||
      firstSalaryMatch(cleanText(document.body?.innerText || ""))
    );
  }

  function textAroundWellfoundTitle() {
    const title = getWellfoundJobTitle();
    if (!title) {
      return "";
    }

    const lines = cleanText(document.body?.innerText || "")
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);
    const titleIndex = lines.findIndex((line) => line === title);

    if (titleIndex === -1) {
      return "";
    }

    return lines.slice(titleIndex, titleIndex + 12).join("\n");
  }

  function bestWellfoundSalaryMatch(text) {
    const matches = salaryMatches(text);

    return matches
      .sort((first, second) => scoreWellfoundSalaryCandidate(second) - scoreWellfoundSalaryCandidate(first))[0] || "";
  }

  function isWellfoundSalaryCandidate(text) {
    const salary = firstSalaryMatch(text);

    return Boolean(
      salary && (
        /\b(?:salary|compensation|pay)\b/i.test(text) ||
        /[kKmM]\b/.test(salary) ||
        /[–-]\s*[$€£₹]?\s*\d/.test(salary)
      )
    );
  }

  function scoreWellfoundSalaryCandidate(candidate) {
    return (
      Number(/[kKmM]\b/.test(candidate)) * 80 +
      Number(/%/.test(candidate)) * 60 +
      Number(/[–-]/.test(candidate)) * 30 -
      Number(!/[kKmM%]/.test(candidate)) * 100
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

  export async function expandWellfoundJobDescription() {
    const aboutHeading = findHeadingElement(/about the job/i);
    const expandButton = Array.from(
      document.querySelectorAll<HTMLElement>("button, [role='button']")
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

  function bigRemoteJobDescriptionElement(): HTMLElement | null {
    const directElement = firstVisibleElement([".bde-rich-text-50-105"]);

    if (directElement) {
      return directElement;
    }

    return Array.from(document.querySelectorAll<HTMLElement>(".breakdance-rich-text-styles, [class*='rich-text']"))
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

    return normalizeSalary(textFromFirst(["[class*='JobDetailHeader'][class*='salary']"]));
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

  function getAshbyJobTitle() {
    return (
      textFromFirst([
        "[data-testid='job-title']",
        "main h1",
        "[role='main'] h1",
        "h1"
      ]) || parseAshbyTitleFromDocument()
    );
  }

  function getAshbyCompanyName() {
    return (
      parseAshbyCompanyFromDocument() ||
      textFromFirst([
        "[data-testid='company-name']",
        "header a[href='/']",
        "header a[href^='/']",
        "main a[href='/']"
      ]) ||
      titleCaseSlug(parseAshbyJobBoardSlug())
    );
  }

  function getAshbyCompanyWebsite() {
    return (
      hrefFromFirst([
        "a[aria-label*='website' i][href^='http']",
        "a[href^='http']"
      ], isExternalWebsiteHref) || ""
    );
  }

  function getAshbySalary() {
    const compensationText = textNearHeading(/compensation|salary|pay range/i);

    return normalizeSalary(
      firstSalaryMatch(compensationText) ||
      firstSalaryMatch(cleanText(document.body?.innerText || ""))
    );
  }

  function getAshbyJobDescription() {
    const descriptionRoot = bestTextElement([
      "[data-testid='job-description']",
      "[data-testid='posting-description']",
      "[class*='JobDescription']",
      "[class*='jobDescription']",
      "[class*='description']"
    ]);
    const directDescription = cleanText(descriptionRoot?.innerText || descriptionRoot?.textContent || "");

    if (directDescription) {
      return stripAshbyBoilerplate(directDescription);
    }

    const pageText = cleanText(
      firstVisibleElement(["main", "[role='main']", "article"])?.innerText ||
      document.body?.innerText ||
      ""
    );

    return stripAshbyBoilerplate(extractAshbyDescription(pageText) || pageText);
  }

  function getYCombinatorJobTitle() {
    return (
      textFromFirst([
        "main h1",
        "article h1",
        "h1"
      ]) || parseYCombinatorTitleFromDocument()
    );
  }

  function getYCombinatorCompanyName() {
    return (
      parseYCombinatorCompanyFromDocument() ||
      textFromFirst([
        "a[href^='/companies/'] h1",
        "a[href^='/companies/']",
        "main h2",
        "aside h2"
      ]) ||
      titleCaseSlug(parseYCombinatorCompanySlug())
    );
  }

  function getYCombinatorCompanyWebsite() {
    return (
      hrefFromFirst([
        "a[href^='http'][aria-label*='website' i]",
        "a[href^='http']"
      ], isExternalWebsiteHref) || ""
    );
  }

  function getYCombinatorSalary() {
    return normalizeSalary(firstSalaryMatch(cleanText(document.body?.innerText || getYCombinatorMetaDescription())));
  }

  function getYCombinatorJobDescription() {
    const metaDescription = getYCombinatorMetaDescription();

    if (metaDescription) {
      return stripYCombinatorBoilerplate(metaDescription);
    }

    const descriptionRoot = bestTextElement([
      "main article",
      "main [class*='prose']",
      "main [class*='whitespace-pre-line']",
      "main [class*='job']",
      "article",
      "main"
    ]);

    return stripYCombinatorBoilerplate(
      extractYCombinatorDescription(cleanText(descriptionRoot?.innerText || descriptionRoot?.textContent || "")) ||
      cleanText(descriptionRoot?.innerText || descriptionRoot?.textContent || "")
    );
  }

  function textFromFirst(selectors: string[]): string {
    const element = firstVisibleElement(selectors);
    return cleanText(element?.innerText || element?.textContent || "");
  }

  function hrefFromFirst(selectors: string[], predicate: (href: string) => boolean = () => true): string {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll<HTMLAnchorElement>(selector));
      const visible = elements.find((element) => isVisible(element) && predicate(element.href || ""));
      if (visible?.href) {
        return visible.href;
      }
    }

    return "";
  }

  function firstVisibleElement(selectors: string[]): HTMLElement | null {
    for (const selector of selectors) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(selector));
      const visible = elements.find(isVisible);
      if (visible) {
        return visible;
      }
    }

    return null;
  }

  function bestTextElement(selectors: string[]): HTMLElement | null {
    const candidates = selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(isVisible)
    );

    return candidates
      .map((element) => ({ element, text: cleanText(element.innerText || "") }))
      .filter((candidate) => candidate.text.length > 80)
      .sort((a, b) => scoreDescriptionCandidate(b) - scoreDescriptionCandidate(a))[0]
      ?.element || null;
  }

  export function scoreDescriptionCandidate(candidate: { text: string }): number {
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

  function isVisible(element: Element): boolean {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rect.width > 0 &&
      rect.height > 0
    );
  }

  export function parseTitleFromDocument() {
    const [title] = document.title.split("|").map((part) => part.trim());
    return cleanText(title || "");
  }

  export function parseWellfoundTitleFromDocument() {
    const title = document.title.split("•")[0]?.trim() || document.title;
    return cleanText(title.replace(/\s+\|\s+Wellfound$/i, ""));
  }

  export function parseCompanyFromDocument() {
    const parts = document.title.split("|").map((part) => part.trim());
    const linkedinIndex = parts.findIndex((part) => /linkedin/i.test(part));
    const candidate = linkedinIndex > 0 ? parts[linkedinIndex - 1] : "";

    return cleanText(candidate);
  }

  export function parseWellfoundCompanyFromDocument() {
    const primaryTitle = document.title.split("•")[0]?.trim() || document.title;
    const atIndex = primaryTitle.lastIndexOf(" at ");

    if (atIndex > -1) {
      return cleanText(primaryTitle.slice(atIndex + 4));
    }

    const byBullet = document.title.split("•").map((part) => cleanText(part));
    return cleanText(byBullet[1] || "");
  }

  export function parseWellfoundCompanyFromMetadata() {
    return cleanText(
      companyFromTitleLikeText(document.querySelector<HTMLMetaElement>("meta[property='og:title']")?.content || "") ||
      companyFromTitleLikeText(document.querySelector<HTMLMetaElement>("meta[name='title']")?.content || "") ||
      companyFromTitleLikeText(document.title)
    );
  }

  function companyFromTitleLikeText(value) {
    const text = cleanText(value);
    const atMatch = text.match(/\s+at\s+(.+?)(?:\s+[|•-]\s+Wellfound|\s+[|•]\s+.+)?$/i);

    if (atMatch?.[1]) {
      return cleanText(atMatch[1]);
    }

    const bulletParts = text.split("•").map((part) => cleanText(part));
    if (/wellfound/i.test(bulletParts[bulletParts.length - 1] || "") && bulletParts.length > 2) {
      return cleanText(bulletParts[bulletParts.length - 2]);
    }

    return "";
  }

  function wellfoundCompanySlugFromHref(href) {
    try {
      const url = new URL(href, window.location.href);
      const [first, second] = url.pathname.split("/").filter(Boolean);

      return first === "company" ? cleanText(second || "") : "";
    } catch (_error) {
      return "";
    }
  }

  export function parseBigRemoteJobTitleFromDocument() {
    const title = document.title.replace(/^Remote\s+/i, "").replace(/\s+at\s+.+$/i, "");
    return cleanText(title);
  }

  export function parseBigRemoteJobCompanyFromDocument() {
    const match = document.title.match(/\s+at\s+(.+)$/i);
    return cleanText(match?.[1] || "");
  }

  export function parseNotYetUnicornsTitleFromDocument() {
    const title = document.title.split("|")[0]?.trim() || document.title;
    return cleanText(title.replace(/\s+at\s+.+$/i, ""));
  }

  export function parseNotYetUnicornsCompanyFromDocument() {
    const match = document.title.match(/\s+at\s+(.+?)\s*(?:\||$)/i);
    return cleanText(match?.[1] || "");
  }

  export function parseAshbyTitleFromDocument() {
    const title = document.title.split("@")[0]?.trim() || document.title;
    return cleanText(title.replace(/\s+\|\s+.+$/i, ""));
  }

  export function parseAshbyCompanyFromDocument() {
    const atMatch = document.title.match(/@\s*([^|]+?)(?:\s*\||$)/);
    return cleanText(atMatch?.[1] || "");
  }

  export function parseAshbyJobBoardSlug() {
    return cleanText(new URL(window.location.href).pathname.split("/").filter(Boolean)[0] || "");
  }

  export function parseYCombinatorTitleFromDocument() {
    const title = document.title.split(" at ")[0]?.trim() || document.title;
    return cleanText(title.replace(/\s+\|\s+Y Combinator$/i, ""));
  }

  export function parseYCombinatorCompanyFromDocument() {
    const titleMatch = document.title.match(/\s+at\s+(.+?)\s*(?:\|\s*Y Combinator)?$/i);
    if (titleMatch?.[1]) {
      return cleanText(titleMatch[1]);
    }

    const metaTitle = cleanText(document.querySelector<HTMLMetaElement>("meta[name='title']")?.content || "");
    const metaMatch = metaTitle.match(/\s+at\s+(.+?)\s*(?:\|\s*Y Combinator)?$/i);
    return cleanText(metaMatch?.[1] || "");
  }

  export function parseYCombinatorCompanySlug() {
    return cleanText(new URL(window.location.href).pathname.split("/").filter(Boolean)[1] || "");
  }

  export function parseBigRemoteJobMetaField(label) {
    const description = cleanText(
      document.querySelector<HTMLMetaElement>("meta[property='og:description']")?.content ||
      document.querySelector<HTMLMetaElement>("meta[name='description']")?.content ||
      ""
    );
    const pattern = new RegExp(`${escapeRegExp(label)}:\\s*([^🪛🌎💸🚀🔥]+)`, "i");
    const match = description.match(pattern);

    return cleanText(match?.[1] || "");
  }

  function findHeadingElement(pattern: RegExp): HTMLElement | undefined {
    return Array.from(
      document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, [role='heading']")
    ).find((element) => isVisible(element) && pattern.test(cleanText(element.innerText)));
  }

  function collectSectionText(heading: Element): string {
    const chunks: string[] = [];
    let current = heading.nextElementSibling;

    while (current) {
      if (isHeading(current) && current !== heading) {
        break;
      }

      const text = cleanText((current as HTMLElement).innerText || current.textContent || "");
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

  export function stripWellfoundBoilerplate(text) {
    return cleanText(
      text
        .replace(/^about the job\s*/i, "")
        .replace(/^job description\s*/i, "")
        .replace(/\n?about the company[\s\S]*$/i, "")
        .replace(/\n?learn more about .+$/i, "")
        .replace(/\n?(apply now|save)\s*$/gim, "")
    );
  }

  export function stripBigRemoteJobBoilerplate(text) {
    return cleanText(
      text
        .replace(/\n?apply for this position[\s\S]*$/i, "")
        .replace(/\n?this job was posted via[\s\S]*$/i, "")
        .replace(/\n?please mention bigremotejob[\s\S]*$/i, "")
        .replace(/\n?related jobs:[\s\S]*$/i, "")
        .replace(/\n?website:\s*https?:\/\/\S+[\s\S]*$/i, "")
    );
  }

  export function stripAshbyBoilerplate(text) {
    return cleanText(
      text
        .replace(/^\s*overview\s*/i, "")
        .replace(/^\s*application\s*/i, "")
        .replace(/\n?application\s*$/i, "")
        .replace(/\n?apply for this job[\s\S]*$/i, "")
        .replace(/\n?apply for this job\s*$/i, "")
    );
  }

  export function stripYCombinatorBoilerplate(text) {
    return cleanText(
      text
        .replace(/\n?apply to role[\s\S]*$/i, "")
        .replace(/\n?apply now[\s\S]*$/i, "")
        .replace(/\n?about the company[\s\S]*$/i, "")
    );
  }

  export function extractWellfoundDescription(text) {
    return (
      extractTextBetween(text, /about the job/i, wellfoundDescriptionEndPatterns()) ||
      extractTextBetween(text, /job description/i, wellfoundDescriptionEndPatterns()) ||
      extractTextBetween(text, /the role/i, wellfoundDescriptionEndPatterns()) ||
      ""
    );
  }

  export function extractBigRemoteJobDescription(text) {
    return (
      extractTextBetween(text, /who we are|job description|about the role|your team and role/i, bigRemoteJobDescriptionEndPatterns()) ||
      ""
    );
  }

  export function extractNotYetUnicornsDescription(text) {
    return (
      extractTextBetween(text, /about us|job description|the role/i, notYetUnicornsDescriptionEndPatterns()) ||
      ""
    );
  }

  export function extractAshbyDescription(text) {
    return (
      extractTextBetween(text, /^overview$/i, ashbyDescriptionEndPatterns()) ||
      extractTextBetween(text, /^(about|about us|the role|job description)$/i, ashbyDescriptionEndPatterns()) ||
      extractTextAfterAshbyMetadata(text)
    );
  }

  export function extractYCombinatorDescription(text) {
    return (
      extractTextBetween(text, /^(about the role|the role|job description)$/i, yCombinatorDescriptionEndPatterns()) ||
      extractTextBetween(text, /^about .+$/i, yCombinatorDescriptionEndPatterns()) ||
      ""
    );
  }

  export function extractTextBetween(text, startPattern, endPatterns) {
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

  export function wellfoundDescriptionEndPatterns() {
    return [
      /about the company/i,
      /similar jobs/i,
      /explore other opportunities/i,
      /find jobs, recruit talent, or learn about our company/i,
      /^apply now$/i
    ];
  }

  export function bigRemoteJobDescriptionEndPatterns() {
    return [
      /^apply for this position$/i,
      /^related jobs:?$/i,
      /^website:\s*https?:\/\//i,
      /^hq location:/i,
      /^established:/i,
      /^company size:/i
    ];
  }

  export function notYetUnicornsDescriptionEndPatterns() {
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

  export function ashbyDescriptionEndPatterns() {
    return [
      /^application$/i,
      /^apply for this job$/i,
      /^submit application$/i
    ];
  }

  export function yCombinatorDescriptionEndPatterns() {
    return [
      /^apply to role$/i,
      /^apply now$/i,
      /^about the company$/i,
      /^founders$/i,
      /^company$/i
    ];
  }

  function getYCombinatorMetaDescription() {
    return cleanText(
      document.querySelector<HTMLMetaElement>("meta[name='description']")?.content ||
      document.querySelector<HTMLMetaElement>("meta[property='og:description']")?.content ||
      ""
    );
  }

  export function extractTextAfterAshbyMetadata(text) {
    const lines = String(text || "")
      .split("\n")
      .map((line) => cleanText(line))
      .filter(Boolean);

    const metadataLabels = [/^location$/i, /^employment type$/i, /^location type$/i, /^department$/i, /^team$/i];
    let startIndex = lines.findIndex((line) => line === getAshbyJobTitle()) + 1;

    if (startIndex === 0) {
      startIndex = 0;
    }

    while (startIndex < lines.length) {
      const line = lines[startIndex];

      if (/^overview$/i.test(line)) {
        startIndex += 1;
        break;
      }

      if (metadataLabels.some((pattern) => pattern.test(line))) {
        startIndex += 2;
        continue;
      }

      break;
    }

    if (startIndex >= lines.length) {
      return "";
    }

    let endIndex = lines.length;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
      if (ashbyDescriptionEndPatterns().some((pattern) => pattern.test(lines[index]))) {
        endIndex = index;
        break;
      }
    }

    return cleanText(lines.slice(startIndex, endIndex).join("\n"));
  }

  function textNearHeading(pattern) {
    const heading = findHeadingElement(pattern);

    if (!heading) {
      return "";
    }

    return cleanText(`${heading.innerText || heading.textContent || ""}\n${collectSectionText(heading)}`);
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

  export function parseJsonValue(value) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return null;
    }
  }

  export function formatNotYetUnicornsSchemaSalary(baseSalary) {
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

  export function salaryCurrencySymbol(currency) {
    const symbols = {
      GBP: "£",
      USD: "$",
      EUR: "€"
    };

    return symbols[currency] || cleanText(currency || "");
  }

  export function formatCompactSalaryNumber(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
      return cleanText(value || "");
    }

    if (number >= 1000 && number % 1000 === 0) {
      return `${number / 1000}k`;
    }

    return String(number);
  }

  export function firstSalaryMatch(text) {
    const matches = salaryMatches(text);

    return cleanText(matches[0] || "");
  }

  function salaryMatches(text) {
    return Array.from(
      String(text || "").matchAll(
        /(?:[$€£₹]\s?\d[\d.,]*\s?[kKmM]?(?:\s*[–-]\s*[$€£₹]?\s?\d[\d.,]*\s?[kKmM]?)?(?:\s*•\s*(?:no equity|[\d.,]+%\s*[–-]\s*[\d.,]+%))?)/gi
      ),
      (match) => cleanText(match[0])
    ).filter(Boolean);
  }

  export function normalizeSalary(value) {
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

  export function isExternalWebsiteHref(href) {
    return Boolean(
      href &&
      /^https?:\/\//.test(href) &&
      !/linkedin\.com|wellfound\.com|bigremotejob\.com|notyetunicorns\.com|ashbyhq\.com|ycombinator\.com/.test(href)
    );
  }

  export function titleCaseSlug(value) {
    return cleanText(value)
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(" ");
  }

  function distanceToElement(first, second) {
    return Math.abs(first.getBoundingClientRect().top - second.getBoundingClientRect().top);
  }

  export function cleanText(value) {
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
