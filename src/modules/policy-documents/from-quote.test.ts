import { describe, expect, it } from "vitest";
import { sampleDocumentInputFromQuote } from "./from-quote";

const quote = {
  driver: { firstName: "Jamie", lastName: "Example", email: "jamie@example.invalid", dateOfBirth: "1990-02-03", phone: "00000000000" },
  address: { line1: "2 Example Road", city: "London", postcode: "AB1 2CD" },
  licence: { number: "SAMPLE-LICENCE" },
  vehicle: { registration: "SAMPLE2", make: "Example", model: "Vehicle", vehicleIdentificationNumber: "SAMPLEVIN000000002" },
  cover: { startAt: "2030-07-01T09:00:00Z", endAt: "2030-07-01T11:00:00Z" },
  pricing: { amount: 25, currency: "GBP" },
};
const order = { publicId: "order-example-1", customerEmail: "jamie@example.invalid", amount: 25, currency: "GBP" };

describe("customer-specific order document snapshot", () => {
  it("maps the customer's real saved quote rather than the preview fixture", () => {
    const input = sampleDocumentInputFromQuote(quote, order);
    expect(input.customer.fullName).toBe("Jamie Example");
    expect(input.customer.drivingLicenceNumber).toBe("SAMPLE-LICENCE");
    expect(input.vehicle.registration).toBe("SAMPLE2");
    expect(input.vehicle.year).toBeUndefined();
    expect(input.policy.policyNumber).toMatch(/^SAMPLE-[A-F0-9]{12}$/);
    expect(input.policy._id).toBe(order.publicId);
  });
  it("maps summer UTC times to London and the original inclusive end minute", () => {
    const input = sampleDocumentInputFromQuote(quote, order);
    expect(input.policy.startTime).toBe("10:00");
    expect(input.policy.endTime).toBe("11:59");
    expect(input.policy.startDate).toBe("2030-07-01");
  });
  it("rejects a different recipient, price, or currency", () => {
    expect(() => sampleDocumentInputFromQuote(quote, { ...order, customerEmail: "other@example.invalid" })).toThrow();
    expect(() => sampleDocumentInputFromQuote(quote, { ...order, amount: 26 })).toThrow();
    expect(() => sampleDocumentInputFromQuote(quote, { ...order, currency: "USD" })).toThrow();
  });
  it("does not create documents with incomplete required customer or vehicle details", () => {
    expect(() => sampleDocumentInputFromQuote({ ...quote, licence: { number: "" } }, order)).toThrow();
    expect(() => sampleDocumentInputFromQuote({ ...quote, vehicle: { ...quote.vehicle, vehicleIdentificationNumber: "" } }, order)).toThrow();
  });
});
