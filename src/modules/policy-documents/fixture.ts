import type { PolicyDocumentInput } from "./schema";

// Fictional data for local tests/previews only. Never use as issuance evidence.
export const samplePolicy: PolicyDocumentInput = {
  policy: {
    _id: "SAMPLE-NOT-AN-ISSUED-POLICY",
    policyNumber: "SAMPLE-NOT-VALID-001",
    premiumAmount: 25,
    excess: 500,
    startDate: "2030-01-15",
    endDate: "2030-01-15",
    startTime: "10:00",
    endTime: "11:59",
    coverageType: "Comprehensive",
    underwriter: "Wakam",
  },
  customer: {
    fullName: "Alex Sample",
    firstName: "Alex",
    email: "alex@example.invalid",
    dateOfBirth: "1995-04-10",
    drivingLicenceNumber: "SAMPLE-NOT-A-LICENCE",
    phone: "00000000000",
    address: { line1: "1 Example Street", city: "Sample Town", postcode: "AB1 2CD", country: "GB" },
  },
  vehicle: {
    registration: "SAMPLE1",
    make: "Example",
    model: "Sample Car",
    vehicleIdentificationNumber: "SAMPLEVIN000000001",
    colour: "Blue",
    year: 2020,
  },
  payment: { method: "stripe" },
};
