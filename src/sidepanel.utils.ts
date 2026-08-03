export function isSupportedJobUrl(url: string | undefined): boolean {
  return isLinkedInJobsUrl(url) || isWellfoundJobsUrl(url) || isBigRemoteJobUrl(url) || isNotYetUnicornsJobUrl(url) || isAshbyJobUrl(url);
}

export function buildRoleFilename(markdown: string): string {
  const company = extractMarkdownSection(markdown, "Company");
  const role = extractMarkdownSection(markdown, "Role");
  const slug = slugify([company, role].filter(Boolean).join("-"));

  return `${slug || "job-role"}.md`;
}

export function extractMarkdownSection(markdown: string, heading: string): string {
  const pattern = new RegExp(`^# ${escapeRegExp(heading)}\\n([\\s\\S]*?)(?=\\n# |$)`, "m");
  const match = markdown.match(pattern);

  return match?.[1]?.trim() || "";
}

function isLinkedInJobsUrl(url: string | undefined): boolean {
  return /^https:\/\/www\.linkedin\.com\/jobs\//.test(url || "");
}

function isWellfoundJobsUrl(url: string | undefined): boolean {
  return /^https:\/\/wellfound\.com\/jobs(?:[/?#]|$)/.test(url || "");
}

function isBigRemoteJobUrl(url: string | undefined): boolean {
  return /^https:\/\/bigremotejob\.com\/remote-jobs\//.test(url || "");
}

function isNotYetUnicornsJobUrl(url: string | undefined): boolean {
  return /^https:\/\/notyetunicorns\.com\/job\//.test(url || "");
}

function isAshbyJobUrl(url: string | undefined): boolean {
  return /^https:\/\/jobs\.ashbyhq\.com\/[^/?#]+\/[0-9a-f-]+\/?(?:[?#].*)?$/i.test(url || "");
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
