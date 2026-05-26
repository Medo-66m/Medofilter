import { describe, expect, it } from "vitest";
import {
  cleanPhone,
  extractPhoneCandidates,
  normalizeDigits,
  safeFilePart,
  withOptionalPlus
} from "@/lib/phone";

describe("phone utils", () => {
  it("converts arabic and persian digits", () => {
    expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789 0123456789");
  });

  it("cleans symbols and removes plus by default", () => {
    expect(cleanPhone("+20 101 666 6666")).toBe("201016666666");
  });

  it("extracts multiple candidates from one cell", () => {
    expect(extractPhoneCandidates("Call +20 101 666 6666 or 201011112222")).toEqual([
      "201016666666",
      "201011112222"
    ]);
  });

  it("rejects values outside 10-15 digits", () => {
    expect(cleanPhone("12345")).toBeNull();
    expect(cleanPhone("1234567890123456")).toBeNull();
  });

  it("adds optional plus only for display", () => {
    expect(withOptionalPlus("201016666666", true)).toBe("+201016666666");
    expect(withOptionalPlus("201016666666", false)).toBe("201016666666");
  });

  it("sanitizes range file names", () => {
    expect(safeFilePart("Range: 27111 / East")).toBe("Range-27111-East");
  });
});
