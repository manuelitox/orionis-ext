import { describe, expect, it } from "vitest";
import { buildOrionisMarkdown } from "../src/markdown.template.js";
import type { CapturedJob } from "../src/types.js";

describe("buildOrionisMarkdown", () => {
  it("formats captured job data into the Orionis markdown template", () => {
    const markdown = buildOrionisMarkdown(
      buildJob({
        company: "Acme",
        title: "Frontend Engineer",
        website: "https://acme.example",
        salary: "$100k - $130k",
        source: "ashby",
        captured_at: "2026-08-03T10:00:00.000Z",
        url: "https://jobs.ashbyhq.com/acme/1234"
      })
    );

    expect(markdown).toBe(`# Captured At
2026-08-03T10:00:00.000Z

# Company
Acme

# Role
Frontend Engineer

# Official Website
https://acme.example

# Source
ashby

# JD URL
https://jobs.ashbyhq.com/acme/1234

# JD
Salary: $100k - $130k

Build reliable product interfaces.

# Notes
`);
  });

  it("trims fields and collapses excessive blank lines in the job description", () => {
    const markdown = buildOrionisMarkdown(
      buildJob({
        company: "  Orionis  ",
        title: "  Product Engineer  ",
        salary: "",
        description: "First line\r\n\r\n\r\nSecond line\n\n\nThird line"
      })
    );

    expect(markdown).toContain("# Company\nOrionis\n");
    expect(markdown).toContain("# Role\nProduct Engineer\n");
    expect(markdown).toContain("# JD\nFirst line\n\nSecond line\n\nThird line\n");
    expect(markdown).not.toContain("Salary:");
  });

  it("renders missing values as empty sections", () => {
    const markdown = buildOrionisMarkdown(buildJob({ description: "" }));

    expect(markdown).toContain("# Company\n\n\n# Role\n");
    expect(markdown).toContain("# JD\n\n\n# Notes\n");
  });
});

function buildJob(overrides: Partial<CapturedJob>): CapturedJob {
  return {
    title: "",
    company: "",
    website: "",
    salary: "",
    description: "Build reliable product interfaces.",
    source: "linkedIn",
    captured_at: "",
    url: "",
    ...overrides
  };
}
