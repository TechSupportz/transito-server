import { afterEach, describe, expect, it, vi } from "vitest"
import { getNUSRouteStopDistances } from "@utils/nus-route-distances"

// 0.01° of longitude at this latitude is ~1.112 km; 0.01° of latitude is ~1.112 km.
const checkpoints = [
	{ latitude: 1.3, longitude: 103.7, isbusstop: null },
	{ latitude: 1.3, longitude: 103.71, isbusstop: true },
	{ latitude: 1.3, longitude: 103.72, isbusstop: null },
	{ latitude: 1.31, longitude: 103.72, isbusstop: true },
	{ latitude: 1.31, longitude: 103.72, isbusstop: true },
	{ latitude: 1.32, longitude: 103.72, isbusstop: null },
]

describe("getNUSRouteStopDistances", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("gives the n-th stop checkpoint's path length, measured from the first stop, to the n-th stop", () => {
		expect(getNUSRouteStopDistances("A1", checkpoints, 3)).toEqual([0, 2.224, 2.224])
	})

	it("measures along the path rather than in a straight line", () => {
		const [, , last] = getNUSRouteStopDistances("A1", checkpoints, 3)!
		const straightLineKm = Math.hypot(1.112, 1.112)

		expect(last).toBeGreaterThan(straightLineKm + 0.6)
	})

	it("leaves distances unknown when stop checkpoints do not match the route stop count", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

		expect(getNUSRouteStopDistances("A1", checkpoints, 4)).toBeNull()
		expect(warn).toHaveBeenCalledOnce()
		expect(warn.mock.calls[0][0]).toContain("A1 has 3 checkpoint stops but 4 route stops")
	})

	it.each([
		["a null point", { latitude: null, longitude: null }],
		["a zero point", { latitude: 0, longitude: 0 }],
		["a point outside Singapore", { latitude: 1.3, longitude: 120 }],
		["an extreme point", { latitude: 1e308, longitude: 1e308 }],
		["a non-finite point", { latitude: Number.NaN, longitude: Number.POSITIVE_INFINITY }],
	])("leaves distances unknown when the path has %s", (_, point) => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
		const withBadPoint = [...checkpoints.slice(0, 2), point as never, ...checkpoints.slice(2)]

		expect(getNUSRouteStopDistances("A1", withBadPoint, 3)).toBeNull()
		expect(warn).toHaveBeenCalledOnce()
		expect(warn.mock.calls[0][0]).toContain("missing or out-of-range positions")
	})

	it("leaves distances unknown when checkpoints could not be fetched", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

		expect(getNUSRouteStopDistances("A1", null, 3)).toBeNull()
		expect(warn).not.toHaveBeenCalled()
	})
})
