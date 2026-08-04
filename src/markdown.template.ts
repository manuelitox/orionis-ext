import type { CapturedJob } from "./types.js";

export type OrionisMarkdownDraft = Omit<CapturedJob, "source"> & {
  source: string;
};

export function buildOrionisMarkdown(job: OrionisMarkdownDraft): string {
  const company = normalizeField(job.company);
  const role = normalizeField(job.title);
  const website = normalizeField(job.website);
  const salary = normalizeField(job.salary);
  const source = normalizeField(job.source);
  const capturedAt = normalizeField(job.captured_at);
  const jdUrl = normalizeField(job.url);
  const jd = normalizeBody(joinJdParts(salary, job.description));

  return `# Captured At
${capturedAt}

# Company
${company}

# Role
${role}

# Official Website
${website}

# Source
${source}

# JD URL
${jdUrl}

# JD
${jd}

# Notes
`;
}

function normalizeField(value: unknown): string {
  return String(value || "").trim();
}

function normalizeBody(value: unknown): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function joinJdParts(salary: string, description: string): string {
  const salaryLine = salary ? `Salary: ${salary}` : "";
  return [salaryLine, description].filter(Boolean).join("\n\n");
}
