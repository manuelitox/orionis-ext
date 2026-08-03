export function isSupportedJobUrl(url: string | undefined): boolean {
  return isLinkedInJobsUrl(url) || isWellfoundJobsUrl(url) || isBigRemoteJobUrl(url) || isNotYetUnicornsJobUrl(url) || isAshbyJobUrl(url);
}

export function unsupportedJobPageMessage(url: string | undefined): string {
  if (isLinkedInUrl(url)) {
    return "This LinkedIn page is not a job post. Open a specific LinkedIn job detail page before capturing.";
  }

  if (isWellfoundUrl(url)) {
    return "This Wellfound page is not a job post. Open a specific Wellfound job detail page before capturing.";
  }

  if (isBigRemoteJobSiteUrl(url)) {
    return "This BigRemoteJob page is not a job post. Open a specific BigRemoteJob job detail page before capturing.";
  }

  if (isNotYetUnicornsUrl(url)) {
    return "This Not Yet Unicorns page is not a job post. Open a specific Not Yet Unicorns job detail page before capturing.";
  }

  if (isAshbyUrl(url)) {
    return "This Ashby page is not a valid job post. Open a specific Ashby job detail page before capturing.";
  }

  return "Open a LinkedIn, Wellfound, BigRemoteJob, Not Yet Unicorns, or Ashby job page before capturing.";
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

function isLinkedInUrl(url: string | undefined): boolean {
  return /^https:\/\/www\.linkedin\.com\//.test(url || "");
}

function isWellfoundJobsUrl(url: string | undefined): boolean {
  return /^https:\/\/wellfound\.com\/jobs(?:[/?#]|$)/.test(url || "");
}

function isWellfoundUrl(url: string | undefined): boolean {
  return /^https:\/\/wellfound\.com\//.test(url || "");
}

function isBigRemoteJobUrl(url: string | undefined): boolean {
  return /^https:\/\/bigremotejob\.com\/remote-jobs\//.test(url || "");
}

function isBigRemoteJobSiteUrl(url: string | undefined): boolean {
  return /^https:\/\/bigremotejob\.com(?:[/?#]|$)/.test(url || "");
}

function isNotYetUnicornsJobUrl(url: string | undefined): boolean {
  return /^https:\/\/notyetunicorns\.com\/job\//.test(url || "");
}

function isNotYetUnicornsUrl(url: string | undefined): boolean {
  return /^https:\/\/notyetunicorns\.com(?:[/?#]|$)/.test(url || "");
}

function isAshbyJobUrl(url: string | undefined): boolean {
  return /^https:\/\/jobs\.ashbyhq\.com\/[^/?#]+\/[0-9a-f-]+\/?(?:[?#].*)?$/i.test(url || "");
}

function isAshbyUrl(url: string | undefined): boolean {
  return /^https:\/\/jobs\.ashbyhq\.com\//.test(url || "");
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
