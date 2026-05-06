# Orionis Capture

Browser extension companion for Orionis. It captures the currently open LinkedIn or Wellfound job page and prepares editable Orionis-compatible Markdown.

## Install Locally

Chrome:

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project directory.
5. Open a LinkedIn or Wellfound job page and click the extension action.

Brave:

1. Open `brave://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project directory.
5. Open a LinkedIn or Wellfound job page and click the extension action.

Brave is Chromium-based, so the extension should work there as long as your Brave version supports extension side panels.

## Workflow

1. Open a LinkedIn or Wellfound job post.
2. Open the Orionis Capture side panel.
3. Review or edit the generated Markdown.
4. Click Save Role and choose your Orionis `roles/` folder.

You can also click Copy Markdown and paste or save it manually.

## Scope

This extension only extracts data from the page you are already viewing. It does not run Orionis analysis, scrape LinkedIn in the background, sync data, or store job posts.

Save Role uses the browser folder picker when available. If direct folder writing is unavailable, it falls back to downloading a `.md` file.
