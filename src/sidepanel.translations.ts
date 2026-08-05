import {
  createTranslator,
  isLanguageSetting,
  isTranslationKey,
  loadLanguageSetting,
  resolveLanguage,
  saveLanguageSetting,
  type LanguageSetting
} from "./i18n/index.js";
import type { UnsupportedJobPageMessages } from "./sidepanel.utils.js";

export type Translator = ReturnType<typeof createTranslator>;

export class SidePanelTranslations {
  private languageSetting: LanguageSetting = "auto";
  private translator: Translator = createTranslator(resolveLanguage(this.languageSetting));

  constructor(private readonly languageSelect: HTMLSelectElement) {
    this.languageSelect.addEventListener("change", () => {
      this.changeLanguage();
    });
  }

  initialize(): void {
    this.languageSetting = loadLanguageSetting();
    this.languageSelect.value = this.languageSetting;
    this.applyTranslations();
  }

  t: Translator = (key, replacements = {}) => this.translator(key, replacements);

  unsupportedJobPageMessages(): UnsupportedJobPageMessages {
    return {
      linkedIn: this.t("errors.unsupported.linkedin"),
      wellfound: this.t("errors.unsupported.wellfound"),
      wellfoundJobListingSlug: this.t("errors.unsupported.wellfoundJobListingSlug"),
      bigRemoteJob: this.t("errors.unsupported.bigremotejob"),
      notYetUnicorns: this.t("errors.unsupported.notyetunicorns"),
      ashby: this.t("errors.unsupported.ashby"),
      yCombinator: this.t("errors.unsupported.ycombinator"),
      generic: this.t("errors.unsupported.generic")
    };
  }

  localizedErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : fallback;
    const sourcePattern = "(LinkedIn|Wellfound|BigRemoteJob|Not Yet Unicorns|Ashby|Y Combinator)";
    const source = message.match(new RegExp(`^${sourcePattern}`))?.[1] || "";

    if (message === "This page is not a supported job posting.") {
      return this.t("errors.extract.unsupported");
    }

    if (new RegExp(`^${sourcePattern} jobs list detected\\.`).test(message)) {
      return this.t("errors.extract.listPage", { source });
    }

    if (message.includes("no job fields were found")) {
      return this.t("errors.extract.noFields", { source });
    }

    if (message.includes("the role title was not found")) {
      return this.t("errors.extract.missingTitle", { source });
    }

    if (message.includes("the company name was not found")) {
      return this.t("errors.extract.missingCompany", { source });
    }

    if (message.includes("the JD body was empty")) {
      return this.t("errors.extract.missingDescription", { source });
    }

    return message;
  }

  private changeLanguage(): void {
    const selectedLanguage = this.languageSelect.value;

    if (!isLanguageSetting(selectedLanguage)) {
      return;
    }

    this.languageSetting = selectedLanguage;
    saveLanguageSetting(this.languageSetting);
    this.applyTranslations();
  }

  private applyTranslations(): void {
    const language = resolveLanguage(this.languageSetting);

    this.translator = createTranslator(language);
    document.documentElement.lang = language;
    document.title = this.t("app.title");

    document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
      const key = element.dataset.i18n;

      if (isTranslationKey(key)) {
        element.textContent = this.t(key);
      }
    });

    document.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((element) => {
      const key = element.dataset.i18nPlaceholder;

      if (isTranslationKey(key)) {
        element.setAttribute("placeholder", this.t(key));
      }
    });

    document.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
      const key = element.dataset.i18nAriaLabel;

      if (isTranslationKey(key)) {
        element.setAttribute("aria-label", this.t(key));
      }
    });

    document.querySelector<HTMLElement>(".toolbar")?.setAttribute("aria-label", this.t("actions.label"));
  }
}
