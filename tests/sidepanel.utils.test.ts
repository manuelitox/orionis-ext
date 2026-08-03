import { describe, expect, it } from "vitest";
import { buildRoleFilename, extractMarkdownSection, isSupportedJobUrl } from "../src/sidepanel.utils.js";

describe("isSupportedJobUrl", () => {
  it("accepts supported job page URLs", () => {
    expect(isSupportedJobUrl("https://www.linkedin.com/jobs/view/123")).toBe(true);
    expect(isSupportedJobUrl("https://wellfound.com/jobs/123")).toBe(true);
    expect(isSupportedJobUrl("https://bigremotejob.com/remote-jobs/frontend-engineer")).toBe(true);
    expect(isSupportedJobUrl("https://notyetunicorns.com/job/platform-engineer")).toBe(true);
    expect(isSupportedJobUrl("https://jobs.ashbyhq.com/acme/123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("rejects unsupported or incomplete URLs", () => {
    expect(isSupportedJobUrl(undefined)).toBe(false);
    expect(isSupportedJobUrl("https://www.linkedin.com/company/acme")).toBe(false);
    expect(isSupportedJobUrl("https://wellfound.com/company/acme")).toBe(false);
    expect(isSupportedJobUrl("https://jobs.ashbyhq.com/acme/not-a-uuid")).toBe(false);
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
