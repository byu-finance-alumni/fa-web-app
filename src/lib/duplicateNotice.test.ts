import { describe, it, expect } from "vitest";
import { parseDuplicateOf } from "./duplicateNotice";

describe("parseDuplicateOf", () => {
  it("returns nothing for a missing parameter", () => {
    expect(parseDuplicateOf(undefined)).toEqual([]);
    expect(parseDuplicateOf("")).toEqual([]);
  });

  it("reads a single id and a comma-separated list", () => {
    expect(parseDuplicateOf("77")).toEqual([77]);
    expect(parseDuplicateOf("77,88")).toEqual([77, 88]);
    expect(parseDuplicateOf(" 77 , 88 ")).toEqual([77, 88]);
  });

  it("drops anything that is not a positive integer", () => {
    // A hand-edited URL must not be able to put arbitrary values into the
    // lookup the notice performs.
    expect(parseDuplicateOf("77,abc,-3,0,4.5,,88")).toEqual([77, 88]);
    expect(parseDuplicateOf("drop table alumni")).toEqual([]);
  });

  it("uses the first value when the parameter is repeated", () => {
    expect(parseDuplicateOf(["77", "999"])).toEqual([77]);
  });
});
