import { describe, expect, it } from "vitest";
import { coordinateLabel, parseNominatimAddress, parsePhotonAddress, validAddressCoordinates } from "./attendanceAddressRules";

describe("attendance address parsing", () => {
  it("validates ranges without rejecting the equator or prime meridian", () => {
    expect(validAddressCoordinates({ latitude: 0, longitude: 0 })).toBe(true);
    for (const point of [{ latitude: NaN, longitude: 1 }, { latitude: 91, longitude: 1 }, { latitude: 1, longitude: 181 }, { latitude: 1 }]) expect(validAddressCoordinates(point)).toBe(false);
    expect(coordinateLabel({ latitude: 10.7769, longitude: 106.7009 })).toBe("10.77690, 106.70090");
  });

  it("builds a readable Vietnamese Photon address, deduplicating repeated administrative names", () => {
    expect(parsePhotonAddress({ features: [{ geometry: { coordinates: [106.7009, 10.7769] }, properties: { name: "Ủy ban nhân dân", housenumber: "86", street: "Lê Thánh Tôn", district: "Sài Gòn", city: "Thành phố Hồ Chí Minh", state: "Thành phố Hồ Chí Minh", country: "Việt Nam" } }] })).toEqual({ status: "resolved", address: "Ủy ban nhân dân, 86 Lê Thánh Tôn, Sài Gòn, Thành phố Hồ Chí Minh, Việt Nam", matchedLatitude: 10.7769, matchedLongitude: 106.7009 });
  });

  it("rejects a Photon result without a valid returned point or a named address", () => {
    expect(parsePhotonAddress({ features: [] })).toEqual({ status: "not_found" });
    expect(parsePhotonAddress({ features: [{ properties: { name: "Place" } }] })).toEqual({ status: "unavailable" });
    expect(parsePhotonAddress({ features: [{ properties: {}, geometry: { coordinates: [0, 0] } }] })).toEqual({ status: "not_found" });
    expect(parsePhotonAddress({ features: "bad" })).toEqual({ status: "unavailable" });
  });

  it("uses actual private-provider output and never invents missing address data", () => {
    expect(parseNominatimAddress({ display_name: "  Số 1, Đường Nguyễn Huệ  ", lat: "10.77", lon: "106.70" })).toEqual({ status: "resolved", address: "Số 1, Đường Nguyễn Huệ", matchedLatitude: 10.77, matchedLongitude: 106.7 });
    expect(parseNominatimAddress({ error: "not found" })).toEqual({ status: "not_found" });
    expect(parseNominatimAddress({ display_name: "Somewhere", lat: null, lon: null })).toEqual({ status: "not_found" });
  });
});
