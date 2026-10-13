import { describe, expect, it } from "vitest";
import { customerProfileSchema } from "./schema";

const completeProfile = {
  title: "Ms",
  firstName: "jane",
  lastName: "doe",
  email: "JANE@EXAMPLE.COM",
  dateOfBirth: "1990-02-10",
  gender: "Female",
  occupation: "software developer",
  phone: "07123456789",
  drivingLicenceNumber: "smith901020ab9cd",
  licenceType: "Full UK",
  licenceHeldFor: "10+ Years",
  lastFourDigits: "1234",
  address: {
    line1: "12 high street",
    line2: "",
    city: "london",
    county: "greater london",
    postcode: "sw1a 1aa",
    country: "GB",
  },
};

describe("shared customer profile validation", () => {
  it("normalizes a complete profile used before checkout", () => {
    const result = customerProfileSchema.parse(completeProfile);
    expect(result.email).toBe("jane@example.com");
    expect(result.firstName).toBe("Jane");
    expect(result.drivingLicenceNumber).toBe("SMITH901020AB9CD");
    expect(result.address.postcode).toBe("SW1A 1AA");
  });

  it("rejects an incomplete payment profile", () => {
    expect(() => customerProfileSchema.parse({ ...completeProfile, gender: "" })).toThrow();
  });
});
