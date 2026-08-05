export function isSupportedJobUrl(url: string | undefined): boolean {
  return isLinkedInJobsUrl(url) || isWellfoundJobsUrl(url) || isBigRemoteJobUrl(url) || isNotYetUnicornsJobUrl(url) || isAshbyJobUrl(url) || isYCombinatorJobUrl(url);
}

export type UnsupportedJobPageMessages = {
  linkedIn: string;
  wellfound: string;
  wellfoundJobListingSlug: string;
  bigRemoteJob: string;
  notYetUnicorns: string;
  ashby: string;
  yCombinator: string;
  generic: string;
};

export function unsupportedJobPageMessage(url: string | undefined, messages: UnsupportedJobPageMessages): string {
  if (isLinkedInUrl(url)) {
    return messages.linkedIn;
  }

  const directWellfoundJobUrl = directWellfoundJobUrlFromListingSlug(url);
  if (directWellfoundJobUrl) {
    return `${messages.wellfoundJobListingSlug} ${directWellfoundJobUrl}`;
  }

  if (isWellfoundUrl(url)) {
    return messages.wellfound;
  }

  if (isBigRemoteJobSiteUrl(url)) {
    return messages.bigRemoteJob;
  }

  if (isNotYetUnicornsUrl(url)) {
    return messages.notYetUnicorns;
  }

  if (isAshbyUrl(url)) {
    return messages.ashby;
  }

  if (isYCombinatorUrl(url)) {
    return messages.yCombinator;
  }

  return messages.generic;
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
  return /^https:\/\/wellfound\.com\/jobs\/[^/?#]+\/?(?:[?#].*)?$/.test(url || "");
}

function isWellfoundUrl(url: string | undefined): boolean {
  return /^https:\/\/wellfound\.com\//.test(url || "");
}

function directWellfoundJobUrlFromListingSlug(url: string | undefined): string {
  try {
    const parsedUrl = new URL(url || "");
    const slug = parsedUrl.searchParams.get("job_listing_slug") || "";

    if (parsedUrl.hostname === "wellfound.com" && parsedUrl.pathname === "/jobs" && slug) {
      return `https://wellfound.com/jobs/${slug}`;
    }
  } catch (_error) {
    return "";
  }

  return "";
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

function isYCombinatorJobUrl(url: string | undefined): boolean {
  return /^https:\/\/(?:www\.workatastartup\.com\/jobs\/\d+|www\.ycombinator\.com\/companies\/[^/?#]+\/jobs\/[^/?#]+)\/?(?:[?#].*)?$/i.test(url || "");
}

function isYCombinatorUrl(url: string | undefined): boolean {
  return /^https:\/\/(?:www\.workatastartup\.com|www\.ycombinator\.com)(?:[/?#]|$)/.test(url || "");
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
