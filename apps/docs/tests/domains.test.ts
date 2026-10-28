/// <reference types="bun" />

// Tests for `readHostname` in registry/lib/domains/types.ts, the check the
// domain field runs before a hostname is sent to the backend.

import { describe, expect, test } from "bun:test";
import { readHostname } from "@/lib/domains/types";

function hostnameOf(value: string): string | null {
  const read = readHostname(value);
  return "hostname" in read ? read.hostname : null;
}

describe("readHostname", () => {
  test.each([
    ["shop.example.com", "shop.example.com"],
    ["  Shop.Example.COM  ", "shop.example.com"],
    ["https://shop.example.com/path?query=1", "shop.example.com"],
    ["http://shop.example.com", "shop.example.com"],
    ["shop.example.com.", "shop.example.com"],
    ["example.com", "example.com"],
    ["a-b.c-d.example.co.uk", "a-b.c-d.example.co.uk"],
  ])("reads %p as %p", (value, expected) => {
    expect(hostnameOf(value)).toBe(expected);
  });

  test("encodes international names as browsers send them", () => {
    expect(hostnameOf("bücher.example")).toBe("xn--bcher-kva.example");
  });

  test.each([
    [""],
    ["   "],
    ["localhost"],
    ["example"],
    ["192.168.1.10"],
    ["https://10.0.0.1/"],
    ["[::1]"],
    ["https://user:pass@shop.example.com"],
    ["shop.example.com:8443"],
    ["-shop.example.com"],
    ["shop-.example.com"],
    ["shop_test.example.com"],
    ["*.example.com"],
    [`${"a".repeat(64)}.example.com`],
    [`${"abcdefghij.".repeat(25)}example.com`],
    ["not a domain"],
    // URLs drop tabs and line breaks, which would join a pasted table row.
    ["shop.example.com\tCNAME"],
    ["exa\tmple.com"],
    ["shop.example\n.com"],
  ])("refuses %p", (value) => {
    expect(hostnameOf(value)).toBeNull();
  });

  test("explains what's wrong", () => {
    expect(readHostname("10.0.0.1")).toEqual({
      error: "Enter a domain name, not an IP address.",
    });
    expect(readHostname("shop.example.com:8443")).toEqual({
      error: "Enter just the domain, such as shop.example.com.",
    });
  });
});
