import { describe, expect, it } from "vitest";
import { cleanRegistration } from "./service";

describe("vehicle registration normalisation", () => {
  it("removes spaces and punctuation and uppercases", () => {
    expect(cleanRegistration(" sj18-obw ")).toBe("SJ18OBW");
  });
});
