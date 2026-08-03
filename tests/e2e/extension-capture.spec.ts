import { expect, test, chromium, type BrowserContext } from "@playwright/test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

type CaptureCase = {
  name: string;
  url: string;
  tabUrlPattern: string;
  title: string;
  fixture: string;
  expectedMarkdown: string[];
};

const captureCases: CaptureCase[] = [
  {
    name: "LinkedIn",
    url: "https://www.linkedin.com/jobs/view/123",
    tabUrlPattern: "https://www.linkedin.com/jobs/*",
    title: "Frontend Engineer",
    fixture: `<!doctype html>
      <html>
        <head><title>Frontend Engineer | Acme | LinkedIn</title></head>
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
      </html>`,
    expectedMarkdown: [
      "# Company\nAcme",
      "# Role\nFrontend Engineer",
      "Build accessible product workflows."
    ]
  },
  {
    name: "Wellfound",
    url: "https://wellfound.com/jobs/456",
    tabUrlPattern: "https://wellfound.com/jobs*",
    title: "Full Stack Engineer",
    fixture: `<!doctype html>
      <html>
        <head><title>Full Stack Engineer at Acme Labs • Wellfound</title></head>
        <body>
          <main>
            <h1>Full Stack Engineer</h1>
            <a href="/company/acme">Acme Labs</a>
            <a href="https://acme-labs.example">Visit our site</a>
            <div class="styles_subheader__DfKjh">$90k - $120k</div>
            <section class="styles_body__k1Fvd">
              About the job
              Build tools for hiring teams.
              About the company
              Boilerplate should not appear.
            </section>
          </main>
        </body>
      </html>`,
    expectedMarkdown: [
      "# Company\nAcme Labs",
      "# Role\nFull Stack Engineer",
      "Build tools for hiring teams."
    ]
  },
  {
    name: "BigRemoteJob",
    url: "https://bigremotejob.com/remote-jobs/product-engineer",
    tabUrlPattern: "https://bigremotejob.com/remote-jobs/*",
    title: "Product Engineer",
    fixture: `<!doctype html>
      <html>
        <head>
          <title>Remote Product Engineer at Remote Co</title>
          <meta property="og:description" content="Company: Remote Co 🌎 Salary: $110k - $140k 💸">
        </head>
        <body>
          <article>
            <h1 class="bde-heading">Product Engineer</h1>
            <a class="ee-postmeta-author">Remote Co</a>
            <a class="ppma-author-user_url-profile-data" href="https://remote-co.example">Website</a>
            <span class="ee-postmeta-term">$110k - $140k</span>
            <section class="bde-rich-text-50-105">
              Who we are
              We build remote-first collaboration software.
              Apply for this position
              Form content
            </section>
          </article>
        </body>
      </html>`,
    expectedMarkdown: [
      "# Company\nRemote Co",
      "# Role\nProduct Engineer",
      "We build remote-first collaboration software."
    ]
  },
  {
    name: "Not Yet Unicorns",
    url: "https://notyetunicorns.com/job/platform-engineer",
    tabUrlPattern: "https://notyetunicorns.com/job/*",
    title: "Platform Engineer",
    fixture: `<!doctype html>
      <html>
        <head><title>Platform Engineer at Scaleup Ltd | Not Yet Unicorns</title></head>
        <body>
          <script id="__NEXT_DATA__" type="application/json">
            {
              "props": {
                "pageProps": {
                  "jobData": {
                    "job": {
                      "role_title": "Platform Engineer",
                      "company_name": "Scaleup Ltd",
                      "salary_range": "£80k - £100k",
                      "description": "Own deployment pipelines and internal platform reliability."
                    },
                    "company": {
                      "name": "Scaleup Ltd",
                      "website_url": "https://scaleup.example"
                    }
                  }
                }
              }
            }
          </script>
          <main><h1>Platform Engineer</h1></main>
        </body>
      </html>`,
    expectedMarkdown: [
      "# Company\nScaleup Ltd",
      "# Role\nPlatform Engineer",
      "Own deployment pipelines and internal platform reliability."
    ]
  },
  {
    name: "Ashby",
    url: "https://jobs.ashbyhq.com/orionis/123e4567-e89b-12d3-a456-426614174000",
    tabUrlPattern: "https://jobs.ashbyhq.com/*/*",
    title: "Staff Engineer",
    fixture: `<!doctype html>
      <html>
        <head><title>Staff Engineer @ Orionis | Ashby</title></head>
        <body>
          <main>
            <h1 data-testid="job-title">Staff Engineer</h1>
            <a aria-label="Company website" href="https://orionis.example">Website</a>
            <h2>Compensation</h2>
            <p>$150k - $190k</p>
            <section data-testid="job-description">
              Overview
              Lead architecture for a browser extension that captures job postings cleanly.
              Apply for this job
              Application form
            </section>
          </main>
        </body>
      </html>`,
    expectedMarkdown: [
      "# Company\nOrionis",
      "# Role\nStaff Engineer",
      "Lead architecture for a browser extension that captures job postings cleanly."
    ]
  }
];

for (const captureCase of captureCases) {
  test(`captures a ${captureCase.name} job page from the extension panel`, async () => {
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
      await context.route(captureCase.url, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: captureCase.fixture
        })
      );

      const jobPage = await context.newPage();
      await jobPage.goto(captureCase.url);
      await expect(jobPage.locator("h1").first()).toHaveText(captureCase.title);

      const panelPage = await context.newPage();
      await panelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);
      await panelPage.evaluate(async (tabUrlPattern) => {
        const [jobTab] = await chrome.tabs.query({ url: tabUrlPattern });

        if (!jobTab?.id) {
          throw new Error(`Fixture tab was not available for ${tabUrlPattern}.`);
        }

        await chrome.tabs.update(jobTab.id, { active: true });
        document.querySelector<HTMLButtonElement>("#refresh")?.click();
      }, captureCase.tabUrlPattern);

      await expect(panelPage.locator("#status")).toHaveText("Markdown ready. Review, copy, or save it.");
      const markdown = await panelPage.locator("#markdown").inputValue();

      for (const expected of captureCase.expectedMarkdown) {
        expect(markdown).toContain(expected);
      }
    } finally {
      await context.close();
    }
  });
}

test("re-translates side panel UI when the language setting changes", async () => {
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
    const panelPage = await context.newPage();
    await panelPage.goto(`chrome-extension://${extensionId}/src/sidepanel.html`);

    await expect(panelPage.locator("#copy")).toContainText("Copy");
    await expect(panelPage.locator("#language-label")).toHaveText("Language");

    await panelPage.locator("#language").selectOption("es");

    await expect(panelPage.locator("#copy")).toContainText("Copiar");
    await expect(panelPage.locator("#save")).toContainText("Guardar");
    await expect(panelPage.locator("#language-label")).toHaveText("Idioma");
    await expect(panelPage.locator("#markdown")).toHaveAttribute(
      "placeholder",
      "Abre una oferta de LinkedIn, Wellfound, BigRemoteJob, Not Yet Unicorns o Ashby y actualiza para generar Markdown estructurado."
    );
  } finally {
    await context.close();
  }
});

async function getExtensionId(context: BrowserContext): Promise<string> {
  let [background] = context.serviceWorkers();
  background ||= await context.waitForEvent("serviceworker");

  return new URL(background.url()).hostname;
}
