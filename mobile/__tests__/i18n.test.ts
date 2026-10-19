/** The translation files, the no-hard-coded-text rule, error codes and dates. */
import { execFileSync } from "child_process";
import path from "path";

import en from "../src/i18n/en.json";
import es from "../src/i18n/es.json";
import i18n, { LANGUAGES } from "../src/i18n";
import { dateBlock, shortDate } from "../src/i18n/dates";
import { errorMessage } from "../src/i18n/errors";

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree, prefix = ""): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((all, [key, value]) => {
    const name = prefix + key;
    return typeof value === "string" ? { ...all, [name]: value } : { ...all, ...flatten(value, `${name}.`) };
  }, {});
}

const english = flatten(en);
const spanish = flatten(es);

describe("translation files", () => {
  it("en.json and es.json have exactly the same keys", () => {
    expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort());
  });

  it.each(LANGUAGES)("%s has no empty values", (language) => {
    const strings = language === "en" ? english : spanish;
    const empty = Object.entries(strings).filter(([, value]) => !value.trim());
    expect(empty).toEqual([]);
  });

  it("keeps the same {{placeholders}} in both languages", () => {
    const placeholders = (text: string) => (text.match(/{{\s*\w+\s*}}/g) ?? []).sort();
    for (const key of Object.keys(english)) {
      expect([key, placeholders(spanish[key])]).toEqual([key, placeholders(english[key])]);
    }
  });

  it("uses Spanish characters that the Outfit font includes", () => {
    // Outfit covers Latin-1 (á é í ó ú ü ñ ¿ ¡). Anything outside it would show as a box.
    // Emoji (🎉 🌱) come from the phone's emoji font, not Outfit.
    const outside = Object.values(spanish)
      .join("")
      .replace(/[\u0000-ÿ·…]/g, "")
      .replace(/\p{Extended_Pictographic}/gu, "");
    expect(outside).toBe("");
    expect(Object.values(spanish).join("")).toMatch(/[áéíóúñ¿¡]/);
  });
});

describe("no hard-coded text", () => {
  const eslint = path.join(__dirname, "..", "node_modules", ".bin", "eslint");
  const cwd = path.join(__dirname, "..");

  it("finds no literal strings in screens or components", () => {
    expect(() => execFileSync(eslint, ["src"], { cwd, encoding: "utf8" })).not.toThrow();
  }, 60000);

  it("would catch one", () => {
    const bad = 'export function Bad() { return <Button title="Save">Hello</Button>; }';
    let output = "";
    try {
      execFileSync(eslint, ["--stdin", "--stdin-filename", "src/app/bad.tsx"], { cwd, input: bad, encoding: "utf8" });
    } catch (error) {
      output = (error as { stdout: string }).stdout;
    }
    expect(output).toContain("i18next/no-literal-string");
    expect(output.match(/no-literal-string/g)).toHaveLength(2);
  }, 60000);
});

describe("error codes", () => {
  const codes = Object.keys(en.errors).filter((code) => code !== "generic");

  it.each(LANGUAGES)("every error code has its own message in %s", (language) => {
    const t = i18n.getFixedT(language);
    const generic = t("errors.generic");
    for (const code of codes) {
      const message = errorMessage(t, { code });
      expect([code, message]).not.toEqual([code, generic]);
      expect(message).not.toContain("errors.");
    }
  });

  it.each(LANGUAGES)("an unknown code shows the generic message in %s", (language) => {
    const t = i18n.getFixedT(language);
    expect(errorMessage(t, { code: "something_new" })).toBe(t("errors.generic"));
  });

  it("fills in the app name", () => {
    const name = require("../../shared/app_config.json").app_name;
    expect(errorMessage(i18n.getFixedT("es"), { code: "outside_denver" })).toContain(name);
  });
});

describe("dates", () => {
  const october24 = new Date("2026-10-24T18:00:00Z");

  it("reads '24 oct' in Spanish and 'Oct 24' in English", () => {
    expect(shortDate(october24, "es")).toBe("24 oct");
    expect(shortDate(october24, "en")).toBe("Oct 24");
  });

  it("puts the month first in English date blocks and the day first in Spanish", () => {
    expect(dateBlock(october24, "en")).toEqual(["OCT", "24"]);
    expect(dateBlock(october24, "es")).toEqual(["24", "OCT"]);
  });
});

describe("event end times", () => {
  const { endServerTime } = require("../src/i18n/dates");

  it("puts an end before the start on the next day (past midnight)", () => {
    expect(endServerTime("2026-10-31", "22:00", "01:00")).toBe("2026-11-01T01:00");
    expect(endServerTime("2026-12-31", "21:00", "00:30")).toBe("2027-01-01T00:30");
  });

  it("keeps a later end on the same day, and an equal one too (the server refuses it)", () => {
    expect(endServerTime("2026-10-31", "18:00", "20:00")).toBe("2026-10-31T20:00");
    expect(endServerTime("2026-10-31", "18:00", "18:00")).toBe("2026-10-31T18:00");
  });
});
