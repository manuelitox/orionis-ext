import { describe, expect, it } from "vitest";
import { buildRoleFilename, extractMarkdownSection, isSupportedJobUrl, unsupportedJobPageMessage } from "../src/sidepanel.utils.js";

const unsupportedJobPageMessages = {
  linkedIn: "This LinkedIn page is not a job post. Open a specific LinkedIn job detail page before capturing.",
  wellfound: "This Wellfound page is not a job post. Open a specific Wellfound job detail page before capturing.",
  bigRemoteJob: "This BigRemoteJob page is not a job post. Open a specific BigRemoteJob job detail page before capturing.",
  notYetUnicorns: "This Not Yet Unicorns page is not a job post. Open a specific Not Yet Unicorns job detail page before capturing.",
  ashby: "This Ashby page is not a valid job post. Open a specific Ashby job detail page before capturing.",
  yCombinator: "This Y Combinator page is not a job post. Open a specific Work at a Startup job detail page before capturing.",
  generic: "Open a LinkedIn, Wellfound, BigRemoteJob, Not Yet Unicorns, Ashby, or Y Combinator job page before capturing."
};

describe("isSupportedJobUrl", () => {
  it("accepts supported job page URLs", () => {
    expect(isSupportedJobUrl("https://www.linkedin.com/jobs/view/123")).toBe(true);
    expect(isSupportedJobUrl("https://wellfound.com/jobs/123")).toBe(true);
    expect(isSupportedJobUrl("https://bigremotejob.com/remote-jobs/frontend-engineer")).toBe(true);
    expect(isSupportedJobUrl("https://notyetunicorns.com/job/platform-engineer")).toBe(true);
    expect(isSupportedJobUrl("https://jobs.ashbyhq.com/acme/123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isSupportedJobUrl("https://www.workatastartup.com/jobs/95982")).toBe(true);
    expect(isSupportedJobUrl("https://www.ycombinator.com/companies/candle/jobs/AzINRDn-growth-lead-creator-program-paid-social")).toBe(true);
  });

  it("rejects unsupported or incomplete URLs", () => {
    expect(isSupportedJobUrl(undefined)).toBe(false);
    expect(isSupportedJobUrl("https://www.linkedin.com/company/acme")).toBe(false);
    expect(isSupportedJobUrl("https://wellfound.com/company/acme")).toBe(false);
    expect(isSupportedJobUrl("https://jobs.ashbyhq.com/acme/not-a-uuid")).toBe(false);
    expect(isSupportedJobUrl("https://www.workatastartup.com/jobs/not-a-number")).toBe(false);
  });
});

describe("unsupportedJobPageMessage", () => {
  it("returns source-specific guidance for known non-job pages", () => {
    expect(unsupportedJobPageMessage("https://www.linkedin.com/feed/", unsupportedJobPageMessages)).toBe("This LinkedIn page is not a job post. Open a specific LinkedIn job detail page before capturing.");
    expect(unsupportedJobPageMessage("https://wellfound.com/company/acme", unsupportedJobPageMessages)).toBe("This Wellfound page is not a job post. Open a specific Wellfound job detail page before capturing.");
    expect(unsupportedJobPageMessage("https://bigremotejob.com/", unsupportedJobPageMessages)).toBe("This BigRemoteJob page is not a job post. Open a specific BigRemoteJob job detail page before capturing.");
    expect(unsupportedJobPageMessage("https://notyetunicorns.com/", unsupportedJobPageMessages)).toBe("This Not Yet Unicorns page is not a job post. Open a specific Not Yet Unicorns job detail page before capturing.");
    expect(unsupportedJobPageMessage("https://jobs.ashbyhq.com/acme/not-a-uuid", unsupportedJobPageMessages)).toBe("This Ashby page is not a valid job post. Open a specific Ashby job detail page before capturing.");
    expect(unsupportedJobPageMessage("https://www.ycombinator.com/", unsupportedJobPageMessages)).toBe("This Y Combinator page is not a job post. Open a specific Work at a Startup job detail page before capturing.");
    expect(unsupportedJobPageMessage("https://www.workatastartup.com/companies/candle", unsupportedJobPageMessages)).toBe("This Y Combinator page is not a job post. Open a specific Work at a Startup job detail page before capturing.");
  });

  it("falls back to generic guidance for unknown pages", () => {
    expect(unsupportedJobPageMessage("https://example.com/jobs/123", unsupportedJobPageMessages)).toBe("Open a LinkedIn, Wellfound, BigRemoteJob, Not Yet Unicorns, Ashby, or Y Combinator job page before capturing.");
  });
});

describe("buildRoleFilename", () => {
  it("builds a stable filename from company and role sections", () => {
    expect(buildRoleFilename(`# Company
Málaga Works

# Role
Senior Frontend Engineer
`)).toBe("malaga-works-senior-frontend-engineer.md");
  });

  it("falls back when company and role sections are empty", () => {
    expect(buildRoleFilename("# Company\n\n# Role\n")).toBe("job-role.md");
  });
});

describe("extractMarkdownSection", () => {
  it("extracts and trims a named markdown section", () => {
    expect(extractMarkdownSection(`# Company
  Acme

# Role
Engineer
`, "Company")).toBe("Acme");
  });

  it("returns an empty string for missing sections", () => {
    expect(extractMarkdownSection("# Role\nEngineer\n", "Company")).toBe("");
  });
});
