import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createHash } from "crypto"
import { gunzipSync } from "zlib"
import { TBusRouteStop } from "@app-types/bus-route-type"
import { TBusService } from "@app-types/bus-service-type"
import { RouteDistanceIndexSchema } from "@app-types/route-distance-index-type"
import { buildRouteDistanceIndex, encodeRouteDistanceIndex } from "@utils/route-distance-index"

const schedule = { weekdays: "06:00", saturday: "06:00", sunday: "06:00" }

const coordinates: Record<string, [number, number]> = {
	"10009": [1.2826543, 103.8174412],
	"10011": [1.2849723, 103.8205601],
	"16181": [1.2966355, 103.7726234],
	LT13: [1.2948012, 103.7705211],
}

function stop(code: string, distance: number, sequence = 1): TBusRouteStop {
	const [latitude, longitude] = coordinates[code]

	return {
		busStop: { code, name: code, roadName: "", latitude, longitude, sources: {} },
		direction: 1,
		sequence,
		distance,
		firstBus: schedule,
		lastBus: schedule,
	}
}

function service(serviceNo: string, routes: TBusRouteStop[][]): TBusService {
	return {
		serviceNo,
		operator: serviceNo === "A1" ? "NUS" : "SBST",
		isLoopService: false,
		isSingleRoute: routes.length === 1,
		interchanges: [routes[0][0].busStop, routes[0][routes[0].length - 1].busStop],
		routes,
	}
}

describe("buildRouteDistanceIndex", () => {
	beforeEach(() => {
		vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("keeps each service's routes in order with [code, cumulativeKm] stops, rounded", () => {
		const index = buildRouteDistanceIndex([
			service("10", [
				[stop("10009", 0), stop("10011", 0.4567), stop("10009", 1.23449)],
				[stop("10011", 0), stop("10009", 0.5)],
			]),
		])

		expect(RouteDistanceIndexSchema.parse(index)).toEqual(index)
		expect(index).toEqual({
			schemaVersion: 1,
			stops: {
				"10009": [1.282654, 103.817441],
				"10011": [1.284972, 103.82056],
			},
			services: {
				"10": [
					[
						["10009", 0],
						["10011", 0.457],
						["10009", 1.234],
					],
					[
						["10011", 0],
						["10009", 0.5],
					],
				],
			},
		})
	})

	it("uses the generated route stop codes, so mapped NUS stops keep their LTA code", () => {
		const index = buildRouteDistanceIndex([
			service("A1", [[stop("LT13", 0), stop("16181", 0.69)]]),
		])

		expect(index.services.A1).toEqual([
			[
				["LT13", 0],
				["16181", 0.69],
			],
		])
		expect(Object.keys(index.stops).sort()).toEqual(["16181", "LT13"])
	})

	it("drops routes whose distances decrease, and services left without routes", () => {
		const index = buildRouteDistanceIndex([
			service("857", [
				[stop("10009", 0), stop("10011", 2)],
				[stop("10011", 0), stop("10009", 3), stop("16181", 1)],
			]),
			service("858", [[stop("10011", 0), stop("16181", 5), stop("LT13", 4)]]),
		])

		expect(index.services).toEqual({
			"857": [
				[
					["10009", 0],
					["10011", 2],
				],
			],
		})
		expect(console.warn).toHaveBeenCalledTimes(2)
	})

	it("drops routes with unknown distances", () => {
		const index = buildRouteDistanceIndex([
			service("A1", [[stop("LT13", 0), stop("16181", 0)]]),
		])

		expect(index).toEqual({ schemaVersion: 1, stops: {}, services: {} })
	})

	it("covers every referenced stop and nothing else", () => {
		const index = buildRouteDistanceIndex([
			service("10", [[stop("10009", 0), stop("10011", 1)]]),
			service("857", [[stop("16181", 0), stop("LT13", 1), stop("16181", 0.5)]]),
		])

		const referenced = new Set(
			Object.values(index.services).flatMap((routes) =>
				routes.flatMap((route) => route.map(([code]) => code)),
			),
		)

		expect(new Set(Object.keys(index.stops))).toEqual(referenced)
	})

	it("serialises the same routes to the same bytes regardless of input order", () => {
		const a = service("10", [[stop("10009", 0), stop("10011", 1)]])
		const b = service("A1", [[stop("LT13", 0), stop("16181", 0.69)]])

		const first = encodeRouteDistanceIndex(buildRouteDistanceIndex([a, b]))
		const second = encodeRouteDistanceIndex(buildRouteDistanceIndex([b, a]))

		expect(second.gzip.equals(first.gzip)).toBe(true)
		expect(second.contentHash).toBe(first.contentHash)
	})
})

describe("encodeRouteDistanceIndex", () => {
	it("gzips the JSON and hashes the uncompressed JSON", () => {
		const index = { schemaVersion: 1 as const, stops: {}, services: {} }
		const encoded = encodeRouteDistanceIndex(index)

		expect(gunzipSync(encoded.gzip).toString("utf8")).toBe(encoded.json)
		expect(JSON.parse(encoded.json)).toEqual(index)
		expect(encoded.contentHash).toBe(
			createHash("sha256").update(encoded.json).digest("hex"),
		)
		// gzip header mtime is zero
		expect(encoded.gzip.readUInt32LE(4)).toBe(0)
	})
})
