# Orionis Capture

Orionis Capture is a lightweight browser extension that turns supported job posts into structured, editable Markdown.

It is designed for people who collect job descriptions for notes, AI-assisted workflows, role tracking, or Orionis. The extension reads the job page you are already viewing, prepares a clean Markdown draft, and lets you copy or save it.

## Supported Sites

Initial support:

- LinkedIn Jobs
- Wellfound
- BigRemoteJob
- Not Yet Unicorns

## Markdown Format

Orionis Capture uses one fixed Markdown structure:

```md
# Captured At

# Company

# Role

# Official Website

# Source

# JD URL

# JD

# Notes
```

The extension captures visible and verifiable fields from the current page. `Source` is derived from the current job URL, and `Captured At` is an ISO timestamp generated when the page is captured. It does not guess hidden fields or infer details that are not available in the job post.

## Workflow

1. Open a supported job post.
2. Open the Orionis Capture side panel.
3. Review the generated Markdown.
4. Click Copy Markdown or Save Markdown.

The Markdown remains editable before copying or saving, so you can clean up any site-specific formatting issues.

## Install Locally

Orionis Capture is not published in the Chrome Web Store yet. For now, the only installation option is a manual Developer Mode installation for testing or local use. For regular users, the recommended installation path will be the Chrome Web Store once the extension is published.

Orionis Capture is built for Chrome and other Chromium-based browsers that support Manifest V3 and extension side panels. Manual installation has been tested with Chrome and Brave.

Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project directory.
5. Open a supported job post and click the extension action.

Brave:

1. Open `brave://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project directory.
5. Open a supported job post and click the extension action.

## Privacy

Orionis Capture is local-first:

- No account is required.
- No backend is used.
- No job data is sent to external servers.
- No background scraping is performed.
- The extension only reads the active tab on supported job sites.
- You decide when to copy, download, or save the generated Markdown.

## Limitations

- Job sites can change their HTML, which may break extraction until the extension is updated.
- Some fields may be empty if the job page does not expose them clearly.
- Salary and company website are captured only when visible or detectable.
- Unsupported job sites are ignored.
- The extension does not analyze, rank, or classify jobs.
- The generated Markdown should be reviewed before use.

## Roadmap

Distribution:

- Publish to the Chrome Web Store

Potential future site support:

- Greenhouse
- Lever
- Ashby
- Workable
- Workday
- Indeed
