import { beforeEach, describe, expect, it } from "vitest";
import { SidePanelTranslations } from "../src/sidepanel.translations.js";

describe("SidePanelTranslations", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
    document.body.innerHTML = `
      <section class="toolbar" aria-label="Capture actions">
        <button><span data-i18n="actions.copy">Copy</span></button>
        <button><span data-i18n="actions.save">Save</span></button>
      </section>
      <button id="settings" aria-label="Open settings" data-i18n-aria-label="settings.open"></button>
      <label id="language-label" for="language" data-i18n="settings.languageLabel">Language</label>
      <select id="language">
        <option value="auto" data-i18n="settings.languageAuto">Auto</option>
        <option value="en" data-i18n="settings.languageEnglish">English</option>
        <option value="es" data-i18n="settings.languageSpanish">Spanish</option>
      </select>
      <textarea id="markdown" data-i18n-placeholder="editor.placeholder"></textarea>
      <p data-i18n="status.ready">Ready</p>
    `;
  });

  it("initializes from saved language and translates visible UI copy", () => {
    localStorage.setItem("language", "es");
    const languageSelect = document.querySelector<HTMLSelectElement>("#language");
    const translations = new SidePanelTranslations(required(languageSelect));

    translations.initialize();

    expect(document.documentElement.lang).toBe("es");
    expect(document.title).toBe("Orionis Capture");
    expect(languageSelect?.value).toBe("es");
    expect(document.querySelector("#settings")?.getAttribute("aria-label")).toBe("Abrir ajustes");
    expect(document.querySelector("#language-label")?.textContent).toBe("Idioma");
    expect(document.querySelector(".toolbar")?.getAttribute("aria-label")).toBe("Acciones de captura");
    expect(document.querySelector("button span")?.textContent).toBe("Copiar");
    expect(document.querySelector("#markdown")?.getAttribute("placeholder")).toBe(
      "Abre una oferta de LinkedIn, Wellfound, BigRemoteJob, Not Yet Unicorns, Ashby o Y Combinator y actualiza para generar Markdown estructurado."
    );
  });

  it("persists and applies language changes", () => {
    const languageSelect = required(document.querySelector<HTMLSelectElement>("#language"));
    const translations = new SidePanelTranslations(languageSelect);
    translations.initialize();

    languageSelect.value = "es";
    languageSelect.dispatchEvent(new Event("change"));

    expect(localStorage.getItem("language")).toBe("es");
    expect(document.querySelector("#language-label")?.textContent).toBe("Idioma");
    expect(translations.t("actions.save")).toBe("Guardar");
  });

  it("ignores unsupported select values", () => {
    const languageSelect = required(document.querySelector<HTMLSelectElement>("#language"));
    const translations = new SidePanelTranslations(languageSelect);
    translations.initialize();

    languageSelect.innerHTML += `<option value="fr">French</option>`;
    languageSelect.value = "fr";
    languageSelect.dispatchEvent(new Event("change"));

    expect(localStorage.getItem("language")).toBeNull();
    expect(translations.t("actions.copy")).toBe("Copy");
  });

  it("returns localized unsupported-page messages", () => {
    localStorage.setItem("language", "es");
    const translations = new SidePanelTranslations(required(document.querySelector<HTMLSelectElement>("#language")));

    translations.initialize();

    expect(translations.unsupportedJobPageMessages().linkedIn).toBe(
      "Esta página de LinkedIn no es una oferta. Abre una página de detalle de una oferta de LinkedIn antes de capturar."
    );
    expect(translations.unsupportedJobPageMessages().yCombinator).toBe(
      "Esta página de Y Combinator no es una oferta. Abre una página de detalle de Work at a Startup antes de capturar."
    );
  });

  it("localizes known extraction errors", () => {
    localStorage.setItem("language", "es");
    const translations = new SidePanelTranslations(required(document.querySelector<HTMLSelectElement>("#language")));

    translations.initialize();

    expect(translations.localizedErrorMessage(new Error("This page is not a supported job posting."), "fallback")).toBe(
      "Esta página no es una oferta compatible."
    );
    expect(
      translations.localizedErrorMessage(
        new Error("LinkedIn jobs list detected. Open a specific job detail page before capturing."),
        "fallback"
      )
    ).toBe("Lista de ofertas de LinkedIn detectada. Abre una página de detalle de una oferta antes de capturar.");
    expect(
      translations.localizedErrorMessage(
        new Error("Ashby page detected, but no job fields were found. Open a specific job detail page, wait for it to finish loading, then click Refresh in Orionis Capture."),
        "fallback"
      )
    ).toContain("no se encontraron datos");
    expect(
      translations.localizedErrorMessage(
        new Error("Wellfound page detected, but the role title was not found. Open the job detail page and wait for the full posting to load before capturing."),
        "fallback"
      )
    ).toContain("no se encontró el título");
    expect(
      translations.localizedErrorMessage(
        new Error("BigRemoteJob page detected, but the company name was not found. Open the job detail page and wait for the full posting to load before capturing."),
        "fallback"
      )
    ).toContain("no se encontró el nombre");
    expect(
      translations.localizedErrorMessage(
        new Error("Not Yet Unicorns page detected, but the JD body was empty. Expand the full description if needed, wait for the page to finish loading, then click Refresh in Orionis Capture."),
        "fallback"
      )
    ).toContain("descripción estaba vacío");
    expect(
      translations.localizedErrorMessage(
        new Error("Y Combinator page detected, but the role title was not found. Open the job detail page and wait for the full posting to load before capturing."),
        "fallback"
      )
    ).toContain("no se encontró el título");
  });

  it("returns unknown errors and fallback text unchanged", () => {
    const translations = new SidePanelTranslations(required(document.querySelector<HTMLSelectElement>("#language")));
    translations.initialize();

    expect(translations.localizedErrorMessage(new Error("Unexpected"), "fallback")).toBe("Unexpected");
    expect(translations.localizedErrorMessage("not an error", "fallback")).toBe("fallback");
  });
});

function required<T>(value: T | null): T {
  if (!value) {
    throw new Error("Expected test element to exist.");
  }

  return value;
}
