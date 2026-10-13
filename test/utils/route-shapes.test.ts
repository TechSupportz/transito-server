import { readFileSync } from "fs"
import path from "path"
import polyline from "@mapbox/polyline"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TBusService } from "../../src/types/bus-service-type"
import { getHaversineDistanceKm } from "../../src/utils/geo"

const mocks = vi.hoisted(() => ({
	getBusServiceFromServiceNo: vi.fn(),
}))

vi.mock("@utils/bus-services", () => ({
	getBusServiceFromServiceNo: mocks.getBusServiceFromServiceNo,
}))

const fixturesDir = path.join(__dirname, "../fixtures")
const readFixture = (file: string) => readFileSync(path.join(fixturesDir, file), "utf8")

// [code, latitude, longitude] for each stop of the real routes the KML fixtures belong to.
const fixtureStops: Record<string, [string, number, number][]> = JSON.parse(
	readFixture("lta-route-kml/stops.json"),
)

const LTA_LIST_URL = "https://www.lta.gov.sg/map/busService/bus_services.xml"
const LTA_KML_URL = "https://www.lta.gov.sg/map/busService/bus_route_kml/"
const ONE_MAP_URL = "https://www.onemap.gov.sg/omapi/om/api/private/busexp/getBusRoutes?busNo="

type TFakeUpstream = {
	listedFiles?: string[]
	kml?: Record<string, string | number>
	oneMap?: Record<string, unknown>
}

function stubUpstreams({ listedFiles = [], kml = {}, oneMap = {} }: TFakeUpstream) {
	const fetchMock = vi.fn(async (url: string) => {
		if (url === LTA_LIST_URL) {
			const files = listedFiles.map((file) => `<file>${file}</file>`).join("")
			return new Response(
				`<bus_service_list><TRUNK><bus_service><kmlFile>${files}</kmlFile></bus_service></TRUNK></bus_service_list>`,
			)
		}

		if (url.startsWith(LTA_KML_URL)) {
			const body = kml[url.slice(LTA_KML_URL.length)] ?? 404
			return typeof body === "number"
				? new Response("<html>Not found</html>", { status: body })
				: new Response(body)
		}

		if (url.startsWith(ONE_MAP_URL)) {
			const body = oneMap[decodeURIComponent(url.slice(ONE_MAP_URL.length))] ?? 500
			return typeof body === "number"
				? new Response("{}", { status: body })
				: new Response(JSON.stringify(body))
		}

		throw new Error(`Unexpected fetch: ${url}`)
	})

	vi.stubGlobal("fetch", fetchMock)
	return fetchMock
}

function makeService(
	serviceNo: string,
	routes: [string, number, number][][],
	operator = "SBST",
): TBusService {
	const routeStops = routes.map((stops, index) =>
		stops.map(([code, latitude, longitude], sequence) => ({
			busStop: { code, name: code, roadName: "", latitude, longitude, sources: {} },
			direction: (index + 1) as 1 | 2,
			sequence: sequence + 1,
			distance: 0,
			firstBus: { weekdays: "", saturday: "", sunday: "" },
			lastBus: { weekdays: "", saturday: "", sunday: "" },
		})),
	)

	return {
		serviceNo,
		operator,
		isLoopService: false,
		isSingleRoute: routes.length === 1,
		interchanges: [routeStops[0][0].busStop, routeStops[0][routeStops[0].length - 1].busStop],
		routes: routeStops,
	}
}

function decode(encoded: string | null | undefined) {
	expect(encoded).toEqual(expect.any(String))
	return polyline.decode(encoded!).map(([latitude, longitude]) => ({ latitude, longitude }))
}

function distanceM(
	from: { latitude: number; longitude: number },
	[, latitude, longitude]: [string, number, number],
) {
	return getHaversineDistanceKm(from, { latitude, longitude }) * 1000
}

async function build(busServices: TBusService[], nusCheckpoints = new Map()) {
	const { buildRoutePolylines } = await import("../../src/utils/route-shapes")
	const result = buildRoutePolylines(busServices, nusCheckpoints)
	await vi.runAllTimersAsync()
	return result
}

describe("buildRoutePolylines", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.resetAllMocks()
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "warn").mockImplementation(() => {})
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("uses a clean KML as it is", async () => {
		stubUpstreams({
			listedFiles: ["10-1.kml"],
			kml: { "10-1.kml": readFixture("lta-route-kml/10-1.kml") },
		})
		const stops = fixtureStops["10-1"]

		const { polylines, summary } = await build([makeService("10", [stops])])
		const line = decode(polylines.get("10")?.[0])

		expect(summary.counts).toMatchObject({ kml: 1, onemap: 0, missing: 0, suspect: 0 })
		expect(distanceM(line[0], stops[0])).toBeLessThan(100)
		expect(distanceM(line[line.length - 1], stops[stops.length - 1])).toBeLessThan(100)
		// Simplifying keeps the shape while dropping most of the 1,087 points.
		expect(line.length).toBeLessThan(700)
	})

	it("joins LineStrings that the KML stores out of order", async () => {
		stubUpstreams({
			listedFiles: ["12-1.kml", "12-2.kml"],
			kml: {
				"12-1.kml": readFixture("lta-route-kml/12-1.kml"),
				"12-2.kml": readFixture("lta-route-kml/12-2.kml"),
			},
		})
		const stops = fixtureStops["12-1"]

		const { polylines, summary } = await build([
			makeService("12", [stops, fixtureStops["12-2"]]),
		])
		const line = decode(polylines.get("12")?.[0])

		expect(summary.counts).toMatchObject({ kml: 2, onemap: 0, missing: 0 })
		// In file order the line would start 13 km away, at the second piece.
		expect(distanceM(line[0], stops[0])).toBeLessThan(100)
		expect(distanceM(line[line.length - 1], stops[stops.length - 1])).toBeLessThan(100)
	})

	it("reverses a KML drawn from the last stop to the first", async () => {
		stubUpstreams({
			listedFiles: ["12-2.kml"],
			kml: { "12-2.kml": readFixture("lta-route-kml/12-2.kml") },
		})
		const stops = fixtureStops["12-2"]

		const { polylines } = await build([makeService("12", [fixtureStops["12-1"], stops])])
		const line = decode(polylines.get("12")?.[1])

		expect(distanceM(line[0], stops[0])).toBeLessThan(100)
		expect(distanceM(line[line.length - 1], stops[stops.length - 1])).toBeLessThan(100)
	})

	it("falls back to OneMap when a KML draws a different route", async () => {
		stubUpstreams({
			listedFiles: ["2B-1.kml"],
			// LTA's 2B-1 KML draws a different route that never reaches Changi Village Terminal.
			kml: { "2B-1.kml": readFixture("lta-route-kml/2B-1.kml") },
			oneMap: { "2B": JSON.parse(readFixture("one-map/bus-routes-2B.json")) },
		})
		const stops = fixtureStops["2B-1"]

		const { polylines, summary } = await build([makeService("2B", [stops])])
		const line = decode(polylines.get("2B")?.[0])

		expect(summary.counts).toMatchObject({ kml: 0, onemap: 1, rejected: 1, missing: 0 })
		expect(summary.rejected[0].reason).toMatch(/^stop \d+ is \d+ m from the line$/)
		expect(summary.onemap[0]).toEqual({
			direction: "2B-1",
			reason: expect.stringMatching(/^KML rejected \(stop \d+ is \d+ m from the line\)$/),
		})
		expect(distanceM(line[0], stops[0])).toBeLessThan(100)
		expect(distanceM(line[line.length - 1], stops[stops.length - 1])).toBeLessThan(100)
	})

	it("rejects OneMap routes whose stops differ, then reuses the previous polyline", async () => {
		const stops = fixtureStops["2B-1"]
		const changedStops = stops.slice(1)
		stubUpstreams({
			oneMap: { "2B": JSON.parse(readFixture("one-map/bus-routes-2B.json")) },
		})
		mocks.getBusServiceFromServiceNo.mockReturnValue({
			...makeService("2B", [changedStops]),
			routePolylines: ["previous"],
		})

		const { polylines, summary } = await build([makeService("2B", [changedStops])])

		expect(polylines.get("2B")).toEqual(["previous"])
		expect(summary.counts).toMatchObject({ reused: 1, missing: 0, notPublished: 1 })
		expect(summary.reused[0]).toEqual({
			direction: "2B-1",
			reason: "KML not listed by LTA; OneMap stops differ (33 vs 32)",
		})
	})

	it("leaves the polyline unknown when the stops changed since the previous catalogue", async () => {
		const stops = fixtureStops["2B-1"]
		stubUpstreams({})
		mocks.getBusServiceFromServiceNo.mockReturnValue({
			...makeService("2B", [stops.slice(1)]),
			routePolylines: ["previous"],
		})

		const { polylines, summary } = await build([makeService("2B", [stops])])

		expect(polylines.get("2B")).toEqual([null])
		expect(summary.missing).toEqual([
			{
				direction: "2B-1",
				reason: "KML not listed by LTA; OneMap fetch failed (Error: HTTP 500)",
			},
		])
	})

	it("stops requesting KMLs once LTA answers 403", async () => {
		const fetchMock = stubUpstreams({
			listedFiles: ["10-1.kml", "12-1.kml", "12-2.kml"],
			kml: { "10-1.kml": 403, "12-1.kml": readFixture("lta-route-kml/12-1.kml") },
		})

		const { summary } = await build([
			makeService("10", [fixtureStops["10-1"]]),
			makeService("12", [fixtureStops["12-1"], fixtureStops["12-2"]]),
		])

		const kmlRequests = fetchMock.mock.calls.filter(([url]) => url.startsWith(LTA_KML_URL))
		expect(kmlRequests).toHaveLength(1)
		expect(summary.fetchFailed.map(({ direction }) => direction)).toEqual([
			"10-1",
			"12-1",
			"12-2",
		])
		expect(summary.counts.missing).toBe(3)
	})

	it("uses the NUS checkpoint path for NUS services", async () => {
		stubUpstreams({})
		const stops: [string, number, number][] = [
			["NUS1", 1.2, 103.7],
			["NUS2", 1.21, 103.71],
		]
		const checkpoints = [
			{ latitude: 1.2, longitude: 103.7, isbusstop: true },
			{ latitude: 1.2, longitude: 103.71, isbusstop: null },
			{ latitude: 1.21, longitude: 103.71, isbusstop: true },
		]

		const { polylines, summary } = await build(
			[makeService("A1", [stops], "NUS")],
			new Map([["A1", checkpoints]]),
		)

		expect(decode(polylines.get("A1")?.[0])).toEqual(
			checkpoints.map(({ latitude, longitude }) => ({ latitude, longitude })),
		)
		expect(summary.counts).toMatchObject({ nus: 1, kml: 0, missing: 0 })
	})
})
