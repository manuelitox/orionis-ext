import { expect, test, chromium, type BrowserContext } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test("captures a supported job page from the extension panel", async () => {
  const extensionPath = resolve("dist");
  const userDataDir = await mkdtemp(join(tmpdir(), "orionis-ext-e2e-"));
  const context = await chromium.launchPersistentContext(userDataDir, {
    channel: "chromium",
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    const extensionId = await getExtensionId(context);
    await context.route("https://www.linkedin.com/jobs/view/123", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: linkedInFixture
      })
    );

    const jobPage = await context.newPage();
    await jobPage.goto("https://www.linkedin.com/jobs/view/123");
    await expect(jobPage.locator("h1")).toHaveText("Frontend Engineer");

    const panelPage = await context.newPage();
    await panelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
    await panelPage.evaluate(async () => {
      const [jobTab] = await chrome.tabs.query({ url: "https://www.linkedin.com/jobs/*" });

      if (!jobTab?.id) {
        throw new Error("LinkedIn fixture tab was not available.");
      }

      await chrome.tabs.update(jobTab.id, { active: true });
      document.querySelector<HTMLButtonElement>("#refresh")?.click();
    });

    await expect(panelPage.locator("#status")).toHaveText("Markdown ready. Review, copy, or save it.");
    const markdown = await panelPage.locator("#markdown").inputValue();

    expect(markdown).toContain("# Company\nAcme");
    expect(markdown).toContain("# Role\nFrontend Engineer");
    expect(markdown).toContain("Build accessible product workflows.");
  } finally {
    await context.close();
  }
});

async function getExtensionId(context: BrowserContext): Promise<string> {
  let [background] = context.serviceWorkers();
  background ||= await context.waitForEvent("serviceworker");

  return new URL(background.url()).hostname;
}

const linkedInFixture = `<!doctype html>
<html>
  <head>
    <title>Frontend Engineer | Acme | LinkedIn</title>
  </head>
  <body>
    <main>
      <h1 class="jobs-unified-top-card__job-title">Frontend Engineer</h1>
      <a class="jobs-unified-top-card__company-name">Acme</a>
      <a href="https://acme.example">Company website</a>
      <section class="jobs-description">
        About the job
        Build accessible product workflows.
        Requirements include TypeScript and browser extension experience.
      </section>
      <p>$120k - $150k</p>
    </main>
  </body>
</html>`;
