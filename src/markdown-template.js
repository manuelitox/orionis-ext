export function buildOrionisMarkdown(job) {
  const company = normalizeField(job.company);
  const role = normalizeField(job.title);
  const jdUrl = normalizeField(job.url);
  const jd = normalizeBody(job.description);

  return `# Company
${company}

# Role
${role}

# Official Website


# JD URL
${jdUrl}

# JD
${jd}

# Notes
`;
}

function normalizeField(value) {
  return String(value || "").trim();
}

function normalizeBody(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
