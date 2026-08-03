import { beforeEach, describe, expect, it } from "vitest";
import {
  browserLanguages,
  createTranslator,
  isLanguageSetting,
  isTranslationKey,
  loadLanguageSetting,
  resolveLanguage,
  saveLanguageSetting
} from "../src/i18n/index.js";

describe("i18n", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("validates supported language settings", () => {
    expect(isLanguageSetting("auto")).toBe(true);
    expect(isLanguageSetting("en")).toBe(true);
    expect(isLanguageSetting("es")).toBe(true);
    expect(isLanguageSetting("fr")).toBe(false);
    expect(isLanguageSetting(null)).toBe(false);
  });

  it("resolves auto from browser language preferences", () => {
    expect(resolveLanguage("auto", ["es-ES", "en-US"])).toBe("es");
    expect(resolveLanguage("auto", ["en-US", "es-ES"])).toBe("en");
    expect(resolveLanguage("auto", ["fr-FR"])).toBe("en");
    expect(resolveLanguage("es", ["en-US"])).toBe("es");
    expect(resolveLanguage("en", ["es-ES"])).toBe("en");
  });

  it("translates keys with replacement values", () => {
    const t = createTranslator("es");

    expect(t("actions.copy")).toBe("Copiar");
    expect(t("status.savedFile", { filename: "role.md" })).toBe("role.md guardado.");
  });

  it("persists the explicit language setting locally", () => {
    expect(loadLanguageSetting()).toBe("auto");

    saveLanguageSetting("es");
    expect(loadLanguageSetting()).toBe("es");

    localStorage.setItem("language", "fr");
    expect(loadLanguageSetting()).toBe("auto");
  });

  it("detects known translation keys", () => {
    expect(isTranslationKey("actions.save")).toBe(true);
    expect(isTranslationKey("missing.key")).toBe(false);
    expect(isTranslationKey(undefined)).toBe(false);
  });

  it("returns navigator languages when available", () => {
    expect(browserLanguages().length).toBeGreaterThan(0);
  });
});
