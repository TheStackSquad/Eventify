//frontend/src / __tests__ / vendors / vendorContract.test.js;


// Source of truth: backend handlers/vendor/vendor_write.go (VendorBinding) and \d vendors
import { toBackendVendorPayload } from "@/services/vendorApi";
import { prepareVendorPayload } from "@/app/vendor/utils/vendorTransformers";
import { vendorRegistrationValidate } from "@/utils/validate/vendorValidate";
import { mockFormData } from "@/__fixtures__/vendorFixtures";

jest.mock("@/axiosConfig/axios", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() },
}));

const GO_BINDING_KEYS = [
  "name", "category", "description", "image_url", "city", "state", "phone_number",
  "first_name", "middle_name", "last_name", "min_price", "vnin_proof", "cac_proof",
];
const FORBIDDEN_KEYS = [
  "vnin", "verified_vnin", "owner_id", "status", "email", "cac_number",
  "is_identity_verified", "is_business_verified", "isIdentityVerified", "isBusinessVerified",
];
const DB_LIMITS = { name: 255, city: 100, firstName: 100, middleName: 100, lastName: 100 };

const wire = (over = {}) =>
  toBackendVendorPayload(
    prepareVendorPayload({ ...mockFormData, vninProof: "p1", cacProof: "p2", ...over }, null, "user-1", false),
  );

describe("vendor API contract", () => {
  it("sends only keys the Go binding accepts", () => {
    expect(Object.keys(wire()).filter((k) => !GO_BINDING_KEYS.includes(k))).toEqual([]);
  });

  it.each(FORBIDDEN_KEYS)("never sends %s", (key) => {
    expect(wire()).not.toHaveProperty(key);
  });

  it("carries both proofs", () => {
    expect(wire()).toMatchObject({ vnin_proof: "p1", cac_proof: "p2" });
  });

  it("sends min_price in whole naira", () => {
    expect(wire({ minPrice: "75000" }).min_price).toBe(75000);
  });
});

describe("vendors table limits are enforced before the request is sent", () => {
  const withValue = (field, length) => ({ ...mockFormData, [field]: "x".repeat(length) });

  it.each(Object.entries(DB_LIMITS))("%s: %i characters is accepted", (field, max) => {
    expect(vendorRegistrationValidate(withValue(field, max), true)[field]).toBeUndefined();
  });

  it.each(Object.entries(DB_LIMITS))("%s: more than %i characters is rejected", (field, max) => {
    expect(vendorRegistrationValidate(withValue(field, max + 1), true)[field]).toBeTruthy();
  });

  it("rejects a price that would overflow int32 kobo", () => {
    expect(vendorRegistrationValidate({ ...mockFormData, minPrice: "21474836" }, true).minPrice).toBeUndefined();
    expect(vendorRegistrationValidate({ ...mockFormData, minPrice: "21474837" }, true).minPrice).toBeTruthy();
  });
});