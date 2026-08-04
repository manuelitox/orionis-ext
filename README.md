# Orionis Capture

Orionis Capture is a lightweight browser extension that turns supported job posts into structured, editable Markdown.

It is designed for people who collect job descriptions for notes, AI-assisted workflows, role tracking, or Orionis. The extension reads supported job pages automatically, prepares a clean Markdown draft, and lets you copy or save it. On unsupported sites, it starts a manual draft with the capture timestamp, source hostname, and current URL so you can paste the job details into the same structure.

## Supported Sites

Initial support:

- LinkedIn Jobs
- Wellfound
- BigRemoteJob
- Not Yet Unicorns
- Ashby

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

The extension captures visible and verifiable fields from supported pages. `Source` is derived from the current job URL, and `Captured At` is an ISO timestamp generated when the page is captured. Manual drafts leave job-specific fields empty. The extension does not guess hidden fields or infer details that are not available in the job post.

## Workflow

1. Open a job post.
2. Open the Orionis Capture side panel.
3. Review the generated Markdown.
4. Click Copy Markdown or Save Markdown.

The Markdown remains editable before copying or saving, so you can clean up any site-specific formatting issues or paste details manually from unsupported sites. Refresh replaces edited content only after confirmation when a supported-page capture succeeds.

## Install Locally

Orionis Capture is not published in the Chrome Web Store yet. For now, the only installation option is a manual Developer Mode installation for testing or local use. For regular users, the recommended installation path will be the Chrome Web Store once the extension is published.

Orionis Capture is built for Chrome and other Chromium-based browsers that support Manifest V3 and extension side panels. Manual installation has been tested with Chrome and Brave.

Build the extension before loading it:

```sh
npm install
npm run build
```

Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the generated `dist` directory.
5. Open a supported job post and click the extension action.

Brave:

1. Open `brave://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select the generated `dist` directory.
5. Open a supported job post and click the extension action.

## Development

Use Node 22 or newer. If you use `nvm`, run:

```sh
nvm use
```

Run the full verification suite before release-oriented changes:

```sh
npm test
```

This runs unit/jsdom tests with coverage thresholds, builds the extension, and runs Playwright smoke tests in Chromium for each supported job source.

For faster local feedback:

```sh
npm run test:unit
npm run test:unit:watch
npm run test:e2e
```

## Privacy

Orionis Capture is local-first:

- No account is required.
- No backend is used.
- No job data is sent to external servers.
- No background scraping is performed.
- The extension only reads the active tab; unsupported pages use the tab URL to prefill manual draft metadata.
- You decide when to copy, download, or save the generated Markdown.

## Limitations

- Job sites can change their HTML, which may break extraction until the extension is updated.
- Some fields may be empty if the job page does not expose them clearly.
- Salary and company website are captured only when visible or detectable.
- Unsupported job sites require manual copy and paste into the generated Markdown draft.
- The extension does not analyze, rank, or classify jobs.
- The generated Markdown should be reviewed before use.

## Roadmap

Distribution:

- Publish to the Chrome Web Store

Potential future site support:

- Greenhouse
- Lever
- Workable
- Workday
- Indeed
