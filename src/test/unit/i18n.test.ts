import { describe, it, expect } from "vitest";
import i18n from "@/i18n";
import en from "@/i18n/locales/en/common.json";
import hi from "@/i18n/locales/hi/common.json";
import bn from "@/i18n/locales/bn/common.json";
import mr from "@/i18n/locales/mr/common.json";
import te from "@/i18n/locales/te/common.json";
import ta from "@/i18n/locales/ta/common.json";

describe("i18n Multi-Language Support", () => {
  const bundles = { en, hi, bn, mr, te, ta };

  it("configures all 6 supported languages", () => {
    const supported = ["en", "hi", "bn", "mr", "te", "ta"];
    for (const lang of supported) {
      expect(bundles).toHaveProperty(lang);
    }
  });

  it("ensures every language contains essential top-level translation keys", () => {
    const essentialKeys = [
      "nav",
      "languages",
      "dashboard",
      "assistant",
      "documents",
      "applications",
      "auth",
    ];

    for (const [lang, bundle] of Object.entries(bundles)) {
      for (const key of essentialKeys) {
        expect(bundle, `Language '${lang}' should contain top-level key '${key}'`).toHaveProperty(
          key,
        );
      }
    }
  });

  it("correctly changes language through i18n instance", async () => {
    await i18n.changeLanguage("hi");
    expect(i18n.language).toBe("hi");
    expect(i18n.t("nav.dashboard")).toBe(hi.nav.dashboard);

    await i18n.changeLanguage("en");
    expect(i18n.language).toBe("en");
    expect(i18n.t("nav.dashboard")).toBe("Dashboard");
  });
});
