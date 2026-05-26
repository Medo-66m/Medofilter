import { describe, expect, it } from "vitest";
import { parseStructuredRows } from "@/lib/file-parser";

describe("structured parsing", () => {
  it("uses Number only when Country / Range / Number exist", () => {
    const rows = [
      {
        Country: "MOROCCO",
        Range: "27111",
        Number: "212710880001"
      }
    ];

    const result = parseStructuredRows(rows);
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe("212710880001");
    expect(result[0].range).toBe("27111");
    expect(result[0].country).toBe("MOROCCO");
  });

  it("does not merge range with number", () => {
    const rows = [
      {
        Country: "MOROCCO",
        Range: "27111",
        Number: "212710880001"
      }
    ];

    const result = parseStructuredRows(rows);
    expect(result[0].value).not.toBe("27111212710880001");
  });

  it("falls back to scanning cells when no phone column exists", () => {
    const rows = [
      {
        Notes: "Client number is +20 101 666 6666",
        Meta: "ok"
      }
    ];

    const result = parseStructuredRows(rows);
    expect(result.map((item) => item.value)).toEqual(["201016666666"]);
  });

  it("ignores range and country cells during fallback", () => {
    const rows = [
      {
        Range: "27111",
        Country: "MOROCCO",
        Notes: "Reach us at 212710880001"
      }
    ];

    const result = parseStructuredRows(rows);
    expect(result.map((item) => item.value)).toEqual(["212710880001"]);
  });

  it("keeps duplicates for pre-dedupe stage", () => {
    const rows = [
      { Number: "201011112222" },
      { Number: "201011112222" }
    ];

    const result = parseStructuredRows(rows);
    expect(result).toHaveLength(2);
  });
});
