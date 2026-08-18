import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { extractJob } from "../src/content-script.js";

describe("extractJob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("extracts a LinkedIn job page", async () => {
    setPage("https://www.linkedin.com/jobs/view/123", `
      <main>
        <h1 class="jobs-unified-top-card__job-title">Frontend Engineer</h1>
        <a class="jobs-unified-top-card__company-name">Acme</a>
        <a href="https://acme.example">Company website</a>
        <section class="jobs-description">
          About the job
          Responsibilities include building accessible UI and reliable product workflows.
          Requirements include TypeScript, browser APIs, and pragmatic testing habits.
        </section>
        <p>$120k - $150k</p>
      </main>
    `, "Frontend Engineer | Acme | LinkedIn");

    const job = await extractJob();

    expect(job).toMatchObject({
      source: "linkedIn",
      title: "Frontend Engineer",
      company: "Acme",
      website: "https://acme.example/",
      salary: "$120k - $150k",
      description: expect.stringContaining("Responsibilities include building accessible UI"),
      url: "https://www.linkedin.com/jobs/view/123"
    });
    expect(job.captured_at).toEqual(expect.any(String));
  });

  it("rejects a LinkedIn jobs page when the job contract is incomplete", async () => {
    setPage("https://www.linkedin.com/jobs/search/?keywords=engineer", `
      <main>
        <h1>Jobs based on your profile</h1>
        <ul>
          <li>Frontend Engineer at Acme</li>
          <li>Backend Engineer at Example Co</li>
        </ul>
      </main>
    `, "LinkedIn Jobs Search");

    await expect(extractJob()).rejects.toThrow("LinkedIn jobs list detected. Open a specific job detail page before capturing.");
  });

  it("extracts a Wellfound job page", async () => {
    setPage("https://wellfound.com/jobs/456", `
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
    `, "Full Stack Engineer at Acme Labs • Wellfound");

    await expect(extractJob()).resolves.toMatchObject({
      source: "wellfound",
      title: "Full Stack Engineer",
      company: "Acme Labs",
      website: "https://acme-labs.example/",
      salary: "$90k - $120k",
      description: "Build tools for hiring teams."
    });
  });

  it("extracts a Wellfound page from fallback text sections", async () => {
    setPage("https://wellfound.com/jobs/457", `
      <main>
        <h1>Backend Engineer</h1>
        <a href="/company/fallback-co">Fallback Co</a>
        <a href="https://fallback.example">External</a>
        <p>$100k - $130k</p>
        <section>
          About the job
          Build APIs for product teams.
          About the company
          Ignore this section.
        </section>
      </main>
    `, "Backend Engineer at Fallback Co • Wellfound");

    await expect(extractJob()).resolves.toMatchObject({
      source: "wellfound",
      title: "Backend Engineer",
      company: "Fallback Co",
      website: "https://fallback.example/",
      salary: "$100k - $130k",
      description: "Build APIs for product teams."
    });
  });

  it("extracts a Wellfound job when company link text is absent", async () => {
    setPage("https://wellfound.com/jobs/3543496-staff-software-engineer-product-engineering-eu", `
      <meta property="og:title" content="Staff Software Engineer, Product Engineering, EU at Ashby • Wellfound">
      <main>
        <a href="/company/ashby" aria-label="Ashby company profile">
          <img alt="Ashby logo">
        </a>
        <h1>Staff Software Engineer, Product Engineering, EU</h1>
        <a href="https://www.ashbyhq.com/">Website</a>
        <p>€141k – €226k</p>
        <section>
          About the job
          Build product engineering systems for recruiting teams.
          About the company
          Company boilerplate should not appear.
        </section>
      </main>
    `, "Wellfound Jobs");

    await expect(extractJob()).resolves.toMatchObject({
      source: "wellfound",
      title: "Staff Software Engineer, Product Engineering, EU",
      company: "Ashby",
      salary: "€141k – €226k",
      description: "Build product engineering systems for recruiting teams."
    });
  });

  it("extracts a Wellfound company from nearby list text when structured company data is absent", async () => {
    setPage("https://wellfound.com/jobs/3543496-staff-software-engineer-product-engineering-eu", `
      <main>
        <section>
          <p>Ashby</p>
          <p>Actively Hiring</p>
          <h1>Staff Software Engineer, Product Engineering, EU</h1>
          <p>€141k – €226k</p>
          <div>
            About the job
            Build product engineering systems for recruiting teams.
            About the company
            Company boilerplate should not appear.
          </div>
        </section>
      </main>
    `, "Wellfound Jobs");

    await expect(extractJob()).resolves.toMatchObject({
      source: "wellfound",
      title: "Staff Software Engineer, Product Engineering, EU",
      company: "Ashby",
      salary: "€141k – €226k",
      description: "Build product engineering systems for recruiting teams."
    });
  });

  it("prefers the Wellfound salary range near the selected listing over unrelated amounts", async () => {
    setPage("https://wellfound.com/jobs/3548419-product-engineer-full-stack", `
      <main>
        <section>
          <p>$200</p>
          <p>Product analytics credits from another listing.</p>
          <p>SignalFlow</p>
          <h1>Product Engineer, Full Stack</h1>
          <p>€100k – €155k • 0.1% – 0.2%</p>
          <div>
            About the job
            Build full-stack product workflows for startup teams.
            About the company
            Company boilerplate should not appear.
          </div>
        </section>
      </main>
    `, "Wellfound Jobs");

    await expect(extractJob()).resolves.toMatchObject({
      source: "wellfound",
      title: "Product Engineer, Full Stack",
      company: "SignalFlow",
      salary: "€100k – €155k • 0.1% – 0.2%",
      description: "Build full-stack product workflows for startup teams."
    });
  });

  it("ignores a Wellfound referral bonus in the salary subheader", async () => {
    setPage("https://wellfound.com/jobs/3548419-product-engineer-full-stack", `
      <main>
        <section>
          <p>SignalFlow</p>
          <h1>Product Engineer, Full Stack</h1>
          <p class="styles_subheader__DfKjh">Refer a friend — earn $200</p>
          <p>€100k – €155k • 0.1% – 0.2%</p>
          <div>
            About the job
            Build full-stack product workflows for startup teams.
            About the company
            Company boilerplate should not appear.
          </div>
        </section>
      </main>
    `, "Wellfound Jobs");

    await expect(extractJob()).resolves.toMatchObject({
      source: "wellfound",
      title: "Product Engineer, Full Stack",
      salary: "€100k – €155k • 0.1% – 0.2%"
    });
  });

  it("does not treat the Wellfound referral widget as salary when no salary is published", async () => {
    setPage("https://wellfound.com/jobs/3915700-ai-ops-engineer-immediate-start", `
      <main>
        <section>
          <p>Ideawise</p>
          <h1>AI OPS Engineer (✨immediate start ✨)</h1>
          <div class="styles_widget__pZ2bH" data-test="CandidateReferralWidget">
            <div class="cursor-pointer" role="button" tabindex="0">
              <div class="styles_widgetIcon__49dxb">
                <p>Refer a friend</p>
                <p>Earn $200</p>
              </div>
            </div>
          </div>
          <div>
            About the job
            Build the AI operating layer for every team.
            About the company
            Company boilerplate should not appear.
          </div>
        </section>
      </main>
    `, "AI OPS Engineer (✨immediate start ✨) at Ideawise • Wellfound");

    await expect(extractJob()).resolves.toMatchObject({
      source: "wellfound",
      title: "AI OPS Engineer (✨immediate start ✨)",
      salary: ""
    });
  });

  it("does not treat salaries from Wellfound similar jobs as the current job salary", async () => {
    setPage("https://wellfound.com/jobs/3915700-ai-ops-engineer-immediate-start", `
      <main>
        <section>
          <p>Ideawise</p>
          <h1>AI OPS Engineer (✨immediate start ✨)</h1>
          <p>No equity</p>
          <div>
            About the job
            Build the AI operating layer for every team.
            About the company
            Company boilerplate should not appear.
          </div>
        </section>
        <section>
          <h2>Similar Jobs</h2>
          <article>
            <h3>Senior Frontend Engineer</h3>
            <p>$70k – $90k • 0.001% – 0.01%</p>
          </article>
        </section>
      </main>
    `, "AI OPS Engineer (✨immediate start ✨) at Ideawise • Wellfound");

    await expect(extractJob()).resolves.toMatchObject({
      source: "wellfound",
      title: "AI OPS Engineer (✨immediate start ✨)",
      salary: ""
    });
  });

  it("extracts a BigRemoteJob page", async () => {
    setPage("https://bigremotejob.com/remote-jobs/product-engineer", `
      <meta property="og:description" content="Company: Remote Co 🌎 Salary: $110k - $140k 💸">
      <article>
        <h1 class="bde-heading">Product Engineer</h1>
        <a class="ee-postmeta-author">Remote Co</a>
        <a class="ppma-author-user_url-profile-data" href="https://remote-co.example">Website</a>
        <span class="ee-postmeta-term">$110k - $140k</span>
        <section class="bde-rich-text-50-105">
          Who we are
          We build remote-first collaboration software for focused engineering teams.
          Apply for this position
          Form content
        </section>
      </article>
    `, "Remote Product Engineer at Remote Co");

    await expect(extractJob()).resolves.toMatchObject({
      source: "bigRemoteJob",
      title: "Product Engineer",
      company: "Remote Co",
      website: "https://remote-co.example/",
      salary: "$110k - $140k",
      description: "Who we are\nWe build remote-first collaboration software for focused engineering teams."
    });
  });

  it("extracts BigRemoteJob descriptions from rich-text fallback candidates", async () => {
    setPage("https://bigremotejob.com/remote-jobs/backend-engineer", `
      <article>
        <h1>Backend Engineer</h1>
        <a rel="author">Remote Fallback Co</a>
        <div class="breakdance-rich-text-styles">
          Your team and role
          Build backend systems for distributed teams with TypeScript and observability.
          Hiring process
          Ignore this part.
        </div>
      </article>
    `, "Remote Backend Engineer at Remote Fallback Co");

    await expect(extractJob()).resolves.toMatchObject({
      source: "bigRemoteJob",
      title: "Backend Engineer",
      company: "Remote Fallback Co",
      description: "Your team and role\nBuild backend systems for distributed teams with TypeScript and observability.\nHiring process\nIgnore this part."
    });
  });

  it("extracts a Not Yet Unicorns page from embedded structured data", async () => {
    setPage("https://notyetunicorns.com/job/789", `
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
    `, "Platform Engineer at Scaleup Ltd | Not Yet Unicorns");

    await expect(extractJob()).resolves.toMatchObject({
      source: "notYetUnicorns",
      title: "Platform Engineer",
      company: "Scaleup Ltd",
      website: "https://scaleup.example",
      salary: "£80k - £100k",
      description: "Own deployment pipelines and internal platform reliability."
    });
  });

  it("extracts a Not Yet Unicorns page from JSON-LD when Next data is absent", async () => {
    setPage("https://notyetunicorns.com/job/790", `
      <script type="application/ld+json">
        [{
          "@type": "JobPosting",
          "title": "Data Engineer",
          "description": "Model data pipelines for early-stage product teams.",
          "hiringOrganization": {
            "name": "Schema Co",
            "sameAs": "https://schema.example"
          },
          "baseSalary": {
            "currency": "EUR",
            "value": {
              "minValue": 70000,
              "maxValue": 90000
            }
          }
        }]
      </script>
    `, "Data Engineer at Schema Co | Not Yet Unicorns");

    await expect(extractJob()).resolves.toMatchObject({
      source: "notYetUnicorns",
      title: "Data Engineer",
      company: "Schema Co",
      website: "https://schema.example",
      salary: "€70k-€90k",
      description: "Model data pipelines for early-stage product teams."
    });
  });

  it("extracts an Ashby job page", async () => {
    setPage("https://jobs.ashbyhq.com/orionis/123e4567-e89b-12d3-a456-426614174000", `
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
    `, "Staff Engineer @ Orionis | Ashby");

    await expect(extractJob()).resolves.toMatchObject({
      source: "ashby",
      title: "Staff Engineer",
      company: "Orionis",
      website: "https://orionis.example/",
      salary: "$150k - $190k",
      description: "Lead architecture for a browser extension that captures job postings cleanly."
    });
  });

  it("uses the ranges in Ashby's compensation section instead of amounts in the description", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);

    setPage("https://jobs.ashbyhq.com/phantom/e7b83c02-55c2-4037-9209-93deb3b7492c", `
      <main>
        <h1>Senior Software Engineer, Frontend</h1>
        <h2>Compensation</h2>
        <p>Base salary: $180,000 - $220,000</p>
        <section data-testid="job-description">
          We offer a $180,000 to $220,000 base salary, plus a $1 referral bonus. This description deliberately contains enough detail to be selected as the job description.
        </section>
      </main>
    `, "Senior Software Engineer, Frontend @ Phantom | Ashby");

    await expect(extractJob()).resolves.toMatchObject({
      salary: "$180,000 - $220,000",
      description: "We offer a $180,000 to $220,000 base salary, plus a $1 referral bonus. This description deliberately contains enough detail to be selected as the job description."
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps every salary range shown in Ashby's compensation section", async () => {
    setPage("https://jobs.ashbyhq.com/ramp/f2ad6068-02e7-4986-967e-804ecef9e043", `
      <main>
        <h1>Financial Partnerships Manager, International</h1>
        <h2>Compensation</h2>
        <ul>
          <li>SF/NY: Target Base Salary $200K – $275K • Offers Equity</li>
          <li>US Nationwide (Remote): Target Base Salary $180K – $245K • Offers Equity</li>
        </ul>
        <h2>Overview</h2>
        <section data-testid="job-description">Build international payment partnerships.</section>
      </main>
    `, "Financial Partnerships Manager, International @ Ramp | Ashby");

    await expect(extractJob()).resolves.toMatchObject({
      salary: "$200K – $275K • $180K – $245K"
    });
  });

  it("does not infer an Ashby salary when the compensation section is absent", async () => {
    setPage("https://jobs.ashbyhq.com/supabase/f048dd68-63f8-4f98-9860-3d5a43c09a01", `
      <main>
        <h1>Product Engineer</h1>
        <section data-testid="job-description">Receive a $1 equipment allowance after joining.</section>
      </main>
    `, "Product Engineer @ Supabase | Ashby");

    await expect(extractJob()).resolves.toMatchObject({
      salary: "",
      description: "Receive a $1 equipment allowance after joining."
    });
  });

  it("extracts a Work at a Startup job page from YC metadata", async () => {
    setPage("https://www.workatastartup.com/jobs/95982", `
      <meta name="description" content="Relationships are the single greatest predictor of long-term health and happiness.

The Role

We're looking for a Growth Lead to own Candle's creator program, UGC engine, and creator community.

Why Candle

  - $130K–$180K depending on experience + equity
">
      <main>
        <h1>Growth Lead – Creator Program & Paid Social</h1>
        <a href="https://www.ycombinator.com/companies/candle">Candle</a>
        <a href="https://www.trycandle.app/">Company website</a>
        <p>$130K - $180K</p>
      </main>
    `, "Growth Lead – Creator Program & Paid Social at Candle | Y Combinator");

    await expect(extractJob()).resolves.toMatchObject({
      source: "yCombinator",
      title: "Growth Lead – Creator Program & Paid Social",
      company: "Candle",
      website: "https://www.trycandle.app/",
      salary: "$130K - $180K",
      description: expect.stringContaining("We're looking for a Growth Lead to own Candle's creator program")
    });
  });

  it("rejects unsupported pages", async () => {
    setPage("https://example.com/jobs/123", "<h1>Unsupported</h1>", "Unsupported");

    await expect(extractJob()).rejects.toThrow("This page is not a supported job posting.");
  });
});

function setPage(url: string, html: string, title: string): void {
  const dom = new JSDOM(html, { url });

  dom.window.document.title = title;
  Object.defineProperty(dom.window.HTMLElement.prototype, "innerText", {
    configurable: true,
    get() {
      return this.textContent;
    },
    set(value) {
      this.textContent = value;
    }
  });
  dom.window.HTMLElement.prototype.getBoundingClientRect = () => ({
    bottom: 100,
    height: 100,
    left: 0,
    right: 100,
    top: 0,
    width: 100,
    x: 0,
    y: 0,
    toJSON: () => ({})
  });

  vi.stubGlobal("window", dom.window);
  vi.stubGlobal("document", dom.window.document);
  vi.stubGlobal("HTMLElement", dom.window.HTMLElement);
  vi.stubGlobal("DOMException", dom.window.DOMException);
}
