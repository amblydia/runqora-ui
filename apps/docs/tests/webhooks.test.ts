/// <reference types="bun" />

// Tests for the helpers in registry/lib/webhooks/types.ts. `showHidden` is
// what keeps text from customers and their endpoints from reading as
// something it isn't, in every webhook component.
//
// Hidden characters are built from their code points, so that none of them
// sits invisibly in this file.

import { describe, expect, test } from "bun:test";
import { getEventLabel, showHidden } from "@/lib/webhooks/types";

const BACKSLASH = String.fromCodePoint(92);

/** The character with this code point. */
function char(code: number): string {
  return String.fromCodePoint(code);
}

/** How `showHidden` writes out the character with this code point. */
function escaped(code: number): string {
  const hex = code.toString(16);
  return hex.length > 4
    ? `${BACKSLASH}u{${hex}}`
    : `${BACKSLASH}u${hex.padStart(4, "0")}`;
}

describe("showHidden", () => {
  test("leaves ordinary text alone", () => {
    const text = 'Café 東京 🙂 {"ok":true} <b>bold</b>';
    expect(showHidden(text)).toBe(text);
  });

  test("keeps tabs and line breaks", () => {
    const text = ["a", "b", "c", "d"].join(char(9)) + char(10) + char(13);
    expect(showHidden(text)).toBe(text);
  });

  test.each([
    ["control characters", [0x00, 0x1b, 0x7f, 0x85]],
    ["bidirectional overrides", [0x20_2a, 0x20_2b, 0x20_2c, 0x20_2d, 0x20_2e]],
    [
      "bidirectional isolates and marks",
      [0x20_66, 0x20_69, 0x20_0e, 0x20_0f, 0x06_1c],
    ],
    ["zero-width characters", [0x20_0b, 0x20_0c, 0x20_0d, 0x20_60, 0xfe_ff]],
    [
      "blank-looking characters",
      [0xad, 0x03_4f, 0x11_5f, 0x31_64, 0xff_a0, 0x18_0e],
    ],
    ["line and paragraph separators", [0x20_28, 0x20_29]],
    ["tag characters, in braces", [0xe_00_41, 0xe_00_7f]],
  ])("writes out %s", (_name, codes) => {
    const text = codes.map((code) => `x${char(code)}`).join("");
    const expected = codes.map((code) => `x${escaped(code)}`).join("");
    expect(showHidden(text)).toBe(expected);
  });

  test("shows a reversed URL as it really is", () => {
    const url = `https://evil.example/${char(0x20_2e)}gro.knab`;
    expect(showHidden(url)).toBe(
      `https://evil.example/${escaped(0x20_2e)}gro.knab`
    );
  });
});

describe("getEventLabel", () => {
  const eventTypes = [{ label: "Invoice paid", value: "invoice.paid" }];

  test("names a known event", () => {
    expect(getEventLabel(eventTypes, "invoice.paid")).toBe("Invoice paid");
  });

  test("falls back to the code", () => {
    expect(getEventLabel(eventTypes, "invoice.voided")).toBe("invoice.voided");
  });
});
