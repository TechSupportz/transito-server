import { describe, expect, it } from "vitest"
import { getNUSVisitNumber } from "@utils/nus-visit-number"
import {
	A1_ROUTE,
	APPROACHING_FIRST_UHALL_OPP,
	APPROACHING_SECOND_UHALL_OPP,
	K_ROUTE,
	UHALL_OPP,
} from "../fixtures/nus-routes"

// About 60 m past UHALL-OPP towards UHC-OPP, just after K's first visit
const LEFT_FIRST_UHALL_OPP = { latitude: 1.2977834, longitude: 103.7776211 }

describe("getNUSVisitNumber", () => {
	it("returns visit 1 for K approaching UHALL-OPP from LT27", () => {
		expect(getNUSVisitNumber(K_ROUTE, "UHALL-OPP", APPROACHING_FIRST_UHALL_OPP)).toBe("1")
	})

	it("returns visit 2 for K approaching UHALL-OPP from UHC", () => {
		expect(getNUSVisitNumber(K_ROUTE, "UHALL-OPP", APPROACHING_SECOND_UHALL_OPP)).toBe("2")
	})

	it("returns visit 2 for K that has just left its first visit to UHALL-OPP", () => {
		expect(getNUSVisitNumber(K_ROUTE, "UHALL-OPP", LEFT_FIRST_UHALL_OPP)).toBe("2")
	})

	it("returns blank for K sitting at UHALL-OPP, where both stretches meet", () => {
		expect(getNUSVisitNumber(K_ROUTE, "UHALL-OPP", UHALL_OPP)).toBe("")
	})

	it("returns blank for a repeated stop when the bus has no live location", () => {
		expect(getNUSVisitNumber(K_ROUTE, "UHALL-OPP", undefined)).toBe("")
		expect(
			getNUSVisitNumber(K_ROUTE, "UHALL-OPP", {
				latitude: Number.NaN,
				longitude: Number.NaN,
			}),
		).toBe("")
	})

	it("returns blank when the bus is far from every stretch", () => {
		expect(getNUSVisitNumber(K_ROUTE, "UHALL-OPP", { latitude: 1.32, longitude: 103.8 })).toBe(
			"",
		)
	})

	it("returns visit 1 for a departure from a loop terminal", () => {
		expect(getNUSVisitNumber(A1_ROUTE, "KRB", APPROACHING_FIRST_UHALL_OPP)).toBe("1")
		expect(getNUSVisitNumber(A1_ROUTE, "KRB", undefined)).toBe("1")
	})

	it("returns visit 1 for a non-repeated stop, with or without a live location", () => {
		expect(getNUSVisitNumber(K_ROUTE, "YIH", APPROACHING_SECOND_UHALL_OPP)).toBe("1")
		expect(getNUSVisitNumber(K_ROUTE, "YIH", undefined)).toBe("1")
	})

	it("returns blank when the route is missing or does not serve the stop", () => {
		expect(getNUSVisitNumber(undefined, "UHALL-OPP", APPROACHING_FIRST_UHALL_OPP)).toBe("")
		expect(getNUSVisitNumber([], "UHALL-OPP", APPROACHING_FIRST_UHALL_OPP)).toBe("")
		expect(getNUSVisitNumber(K_ROUTE, "COM3", APPROACHING_FIRST_UHALL_OPP)).toBe("")
	})
})
