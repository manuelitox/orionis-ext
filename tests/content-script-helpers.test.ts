import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ashbyDescriptionEndPatterns,
  bigRemoteJobDescriptionEndPatterns,
  buildCaptureMetadata,
  cleanText,
  extractAshbyDescription,
  extractBigRemoteJobDescription,
  extractNotYetUnicornsDescription,
  extractTextAfterAshbyMetadata,
  extractTextBetween,
  extractWellfoundDescription,
  expandLinkedInJobDescription,
  expandWellfoundJobDescription,
  findJobSource,
  firstSalaryMatch,
  formatCompactSalaryNumber,
  formatNotYetUnicornsSchemaSalary,
  isExternalWebsiteHref,
  normalizeSalary,
  notYetUnicornsDescriptionEndPatterns,
  parseAshbyCompanyFromDocument,
  parseAshbyJobBoardSlug,
  parseAshbyTitleFromDocument,
  parseBigRemoteJobCompanyFromDocument,
  parseBigRemoteJobMetaField,
  parseBigRemoteJobTitleFromDocument,
  parseCompanyFromDocument,
  parseJsonValue,
  parseNotYetUnicornsCompanyFromDocument,
  parseNotYetUnicornsTitleFromDocument,
  parseTitleFromDocument,
  parseWellfoundCompanyFromDocument,
  parseWellfoundTitleFromDocument,
  salaryCurrencySymbol,
  scoreDescriptionCandidate,
  stripAshbyBoilerplate,
  stripBigRemoteJobBoilerplate,
  stripWellfoundBoilerplate,
  titleCaseSlug,
  validateAshbyJob,
  validateBigRemoteJob,
  validateCapturedJobContract,
  validateNotYetUnicornsJob,
  wellfoundDescriptionEndPatterns
} from "../src/content-script.js";
import type { CapturedJob } from "../src/content-script.types.js";

describe("content script parser helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("finds supported job source definitions", () => {
    expect(findJobSource("https://www.linkedin.com/jobs/view/1")?.source).toBe("linkedIn");
    expect(findJobSource("https://wellfound.com/jobs/1")?.source).toBe("wellfound");
    expect(findJobSource("https://bigremotejob.com/remote-jobs/role")?.source).toBe("bigRemoteJob");
    expect(findJobSource("https://notyetunicorns.com/job/role")?.source).toBe("notYetUnicorns");
    expect(findJobSource("https://jobs.ashbyhq.com/acme/123e4567-e89b-12d3-a456-426614174000")?.source).toBe("ashby");
    expect(findJobSource("https://example.com/jobs/1")).toBeUndefined();
  });

  it("builds capture metadata with an ISO timestamp", () => {
    const metadata = buildCaptureMetadata("ashby");

    expect(metadata.source).toBe("ashby");
    expect(Date.parse(metadata.captured_at)).not.toBeNaN();
  });

  it("parses fallback titles and companies from document metadata", () => {
    setDocument("https://jobs.ashbyhq.com/acme-corp/job-id", "", "Senior Engineer | Acme | LinkedIn");
    expect(parseTitleFromDocument()).toBe("Senior Engineer");
    expect(parseCompanyFromDocument()).toBe("Acme");

    setDocument("https://wellfound.com/jobs/1", "", "Product Designer at Startup Co • Wellfound");
    expect(parseWellfoundTitleFromDocument()).toBe("Product Designer at Startup Co");
    expect(parseWellfoundCompanyFromDocument()).toBe("Startup Co");

    setDocument("https://wellfound.com/jobs/1", "", "Product Designer • Startup Co");
    expect(parseWellfoundCompanyFromDocument()).toBe("Startup Co");

    setDocument("https://bigremotejob.com/remote-jobs/product-engineer", "", "Remote Product Engineer at Remote Co");
    expect(parseBigRemoteJobTitleFromDocument()).toBe("Product Engineer");
    expect(parseBigRemoteJobCompanyFromDocument()).toBe("Remote Co");

    setDocument("https://notyetunicorns.com/job/1", "", "Platform Engineer at Scaleup | Not Yet Unicorns");
    expect(parseNotYetUnicornsTitleFromDocument()).toBe("Platform Engineer");
    expect(parseNotYetUnicornsCompanyFromDocument()).toBe("Scaleup");

    setDocument("https://jobs.ashbyhq.com/orionis-labs/job-id", "", "Staff Engineer @ Orionis Labs | Ashby");
    expect(parseAshbyTitleFromDocument()).toBe("Staff Engineer");
    expect(parseAshbyCompanyFromDocument()).toBe("Orionis Labs");
    expect(parseAshbyJobBoardSlug()).toBe("orionis-labs");
  });

  it("parses BigRemoteJob meta fields", () => {
    setDocument("https://bigremotejob.com/remote-jobs/role", `
      <meta name="description" content="Company: Remote Co 🌎 Salary: $100k - $120k 💸">
    `, "Role at Remote Co");

    expect(parseBigRemoteJobMetaField("Company")).toBe("Remote Co");
    expect(parseBigRemoteJobMetaField("Salary")).toBe("$100k - $120k");
    expect(parseBigRemoteJobMetaField("Missing")).toBe("");
  });

  it("strips common boilerplate from extracted descriptions", () => {
    expect(stripWellfoundBoilerplate("About the job\nBuild product.\nAbout the company\nIgnore")).toBe("Build product.");
    expect(stripWellfoundBoilerplate("Job description\nBuild product.\nApply now")).toBe("Build product.");

    expect(stripBigRemoteJobBoilerplate("Build product.\nApply for this position\nForm")).toBe("Build product.");
    expect(stripBigRemoteJobBoilerplate("Build product.\nWebsite: https://example.com")).toBe("Build product.");

    expect(stripAshbyBoilerplate("Overview\nBuild product.\nApply for this job\nForm")).toBe("Build product.");
    expect(stripAshbyBoilerplate("Application\nBuild product.\nApplication")).toBe("Build product.");
  });

  it("extracts text sections for supported sources", () => {
    expect(extractWellfoundDescription("Intro\nAbout the job\nBuild product.\nAbout the company\nIgnore")).toBe("Build product.");
    expect(extractWellfoundDescription("Intro\nThe role\nBuild product.\nApply now")).toBe("Build product.");
    expect(extractBigRemoteJobDescription("Intro\nYour team and role\nBuild product.\nRelated jobs:")).toBe("Build product.");
    expect(extractNotYetUnicornsDescription("Intro\nThe role\nBuild product.\nLocation\nRemote")).toBe("Build product.");
    expect(extractAshbyDescription("Intro\nOverview\nBuild product.\nApplication\nForm")).toBe("Build product.");
    expect(extractTextBetween("A\nStart\nMiddle\nEnd\nZ", /^start$/i, [/^end$/i])).toBe("Middle");
    expect(extractTextBetween("A\nMiddle\nEnd", /^start$/i, [/^end$/i])).toBe("");
  });

  it("extracts Ashby descriptions after metadata blocks", () => {
    setDocument("https://jobs.ashbyhq.com/acme/job-id", "", "Staff Engineer @ Acme | Ashby");

    expect(extractTextAfterAshbyMetadata(`Staff Engineer
Location
Remote
Employment Type
Full Time
Build product reliability.
Apply for this job`)).toBe("Build product reliability.");
  });

  it("formats salary values", () => {
    expect(firstSalaryMatch("Compensation is $120k - $150k • no equity")).toBe("$120k - $150k • no equity");
    expect(firstSalaryMatch("No salary here")).toBe("");
    expect(normalizeSalary("")).toBe("");
    expect(normalizeSalary("$0 - $0")).toBe("");
    expect(normalizeSalary(" $100k - $130k ")).toBe("$100k - $130k");
    expect(formatNotYetUnicornsSchemaSalary({ currency: "USD", value: { minValue: 80000, maxValue: 120000 } })).toBe("$80k-$120k");
    expect(formatNotYetUnicornsSchemaSalary({ currency: "EUR", value: { value: 95000 } })).toBe("€95k");
    expect(formatNotYetUnicornsSchemaSalary({ currency: "GBP", value: null })).toBe("");
    expect(formatNotYetUnicornsSchemaSalary({ currency: "USD", value: {} })).toBe("");
    expect(salaryCurrencySymbol("JPY")).toBe("JPY");
    expect(formatCompactSalaryNumber(1234)).toBe("1234");
    expect(formatCompactSalaryNumber("unknown")).toBe("unknown");
  });

  it("normalizes text, URLs, and scoring helpers", () => {
    expect(cleanText(" Show more \n\nBuild\t\tproduct.\u00a0\n\n\nSee less")).toBe("Build product.");
    expect(isExternalWebsiteHref("https://example.com")).toBe(true);
    expect(isExternalWebsiteHref("https://www.linkedin.com/company/acme")).toBe(false);
    expect(isExternalWebsiteHref("mailto:hello@example.com")).toBe(false);
    expect(titleCaseSlug("orionis-labs_platform team")).toBe("Orionis Labs Platform Team");
    expect(scoreDescriptionCandidate({ text: "About the job\nResponsibilities\nBuild product." })).toBeGreaterThan(
      scoreDescriptionCandidate({ text: "Short show more" })
    );
  });

  it("parses JSON safely", () => {
    expect(parseJsonValue("{\"ok\":true}")).toEqual({ ok: true });
    expect(parseJsonValue("not json")).toBeNull();
  });

  it("exposes source-specific section end patterns", () => {
    expect(wellfoundDescriptionEndPatterns().some((pattern) => pattern.test("Apply now"))).toBe(true);
    expect(bigRemoteJobDescriptionEndPatterns().some((pattern) => pattern.test("Website: https://example.com"))).toBe(true);
    expect(notYetUnicornsDescriptionEndPatterns().some((pattern) => pattern.test("Location"))).toBe(true);
    expect(ashbyDescriptionEndPatterns().some((pattern) => pattern.test("Submit application"))).toBe(true);
  });

  it("clicks LinkedIn show-more buttons inside the description", async () => {
    setVisibleDocument("https://www.linkedin.com/jobs/view/1", `
      <section class="jobs-description">
        <button aria-label="Show more">More</button>
      </section>
    `, "Role | Company | LinkedIn");
    const button = document.querySelector("button") as HTMLButtonElement;
    const click = vi.spyOn(button, "click");

    await expandLinkedInJobDescription();

    expect(click).toHaveBeenCalledOnce();
  });

  it("clicks nearby Wellfound read-more buttons", async () => {
    setVisibleDocument("https://wellfound.com/jobs/1", `
      <main>
        <h2>About the job</h2>
        <button aria-label="Read more"></button>
      </main>
    `, "Role at Company • Wellfound");
    const button = document.querySelector("button") as HTMLButtonElement;
    const click = vi.spyOn(button, "click");

    await expandWellfoundJobDescription();

    expect(click).toHaveBeenCalledOnce();
  });

  it("validates the required capture contract", () => {
    expect(() => validateCapturedJobContract(job({ title: "", company: "", description: "" }))).toThrow("no job fields were found");
    expect(() => validateCapturedJobContract(job({ title: "", company: "Co", description: "Build." }))).toThrow("role title was not found");
    expect(() => validateCapturedJobContract(job({ title: "Role", company: "", description: "Build." }))).toThrow("company name was not found");
    expect(() => validateCapturedJobContract(job({ title: "Role", company: "Co", description: "" }))).toThrow("JD body was empty");
    expect(() => validateCapturedJobContract(job({ title: "Role", company: "Co", description: "Build." }))).not.toThrow();
  });

  it("keeps legacy source validators on the shared capture contract", () => {
    expect(() => validateBigRemoteJob(job({ title: "Role", company: "Co", description: "Build." }))).not.toThrow();
    expect(() => validateNotYetUnicornsJob(job({ title: "Role", company: "Co", description: "Build." }))).not.toThrow();
    expect(() => validateAshbyJob(job({ title: "Role", company: "Co", description: "Build." }))).not.toThrow();
  });
});

function setDocument(url: string, html: string, title: string): void {
  const dom = new JSDOM(html, { url });
  dom.window.document.title = title;

  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
}

function setVisibleDocument(url: string, html: string, title: string): void {
  const dom = new JSDOM(html, { url });
  dom.window.document.title = title;
  Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
    set(value) {
      this.textContent = value;
    }
  });
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    bottom: 100,
    height: 100,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
    toJSON: () => ({})
  });

  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
}

function job(overrides: Partial<CapturedJob>): CapturedJob {
  return {
    title: "Role",
    company: "Company",
    website: "",
    salary: "",
    description: "Build.",
    source: "test",
    captured_at: "",
    url: "",
    ...overrides
  };
}
