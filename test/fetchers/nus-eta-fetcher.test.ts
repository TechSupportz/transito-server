import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	getUnivusSession: vi.fn(),
}))

vi.mock("@fetchers/univus-token-fetcher", () => ({
	getUnivusSession: mocks.getUnivusSession,
}))

import {
	fetchNUSActiveBuses,
	fetchNUSPickupPoints,
	fetchNUSRouteMinMaxTimes,
	fetchNUSShuttleService,
} from "@fetchers/nus-eta-fetcher"

function response(data: unknown, code = "00000", msg = "") {
	return new Response(
		JSON.stringify({
			data,
			code,
			msg,
			ts: "20260903163000",
		}),
		{ status: 200, headers: { "Content-Type": "application/json" } },
	)
}

describe("NUS ETA proxy fetcher", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.stubEnv("NUS_ETA_TOKEN", "sanitized-runtime-key")
		mocks.getUnivusSession.mockReset()
		mocks.getUnivusSession.mockResolvedValue({
			token: "sanitized-access-token",
			userid: "sanitized-userid",
			domain: "PUBLIC",
			deviceid: "sanitized-deviceid",
			ipaddr: "",
			version: "",
		})
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("fetches and unwraps shuttle arrivals with the proxy headers", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			response({
				TimeStamp: "20260903163000",
				caption: "COM3",
				name: "D1",
				shuttles: [
					{
						name: "D1",
						routeid: 1,
						busstopcode: "COM3",
						arrivalTime: "2 min",
						nextArrivalTime: "11 min",
						_etas: [{ eta: "2" }, { eta: 11 }],
					},
				],
				hints: [],
			}),
		)

		const shuttles = await fetchNUSShuttleService("COM3")

		expect(fetchMock).toHaveBeenCalledWith(
			"https://inetapps.nus.edu.sg/univus/api/bus-proxy/shuttle-service",
			{
				method: "POST",
				headers: {
					Accept: "application/json",
					Authorization: "Bearer sanitized-access-token",
					"Content-Type": "application/json",
					"X-API-KEY": "sanitized-runtime-key",
				},
				body: JSON.stringify({
					busstopname: "COM3",
					token: "sanitized-access-token",
					userid: "sanitized-userid",
					domain: "PUBLIC",
					deviceid: "sanitized-deviceid",
					ipaddr: "",
					version: "",
				}),
			},
		)
		expect(shuttles).toEqual([
			expect.objectContaining({
				name: "D1",
				busstopcode: "COM3",
			}),
		])
		expect(shuttles[0]._etas.map(({ eta }) => eta)).toEqual([2, 11])
	})

	it("uses the migrated pickup, route-time, and active-bus routes", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValueOnce(
				response({
					pickuppoint: [
						{
							seq: 1,
							LongName: "COM 3",
							busstopcode: "COM3",
							lat: 1.294,
							lng: 103.774,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				response({
					RouteMinMaxTime: [
						{
							DisplayOrder: "1",
							Route: "D1",
							FirstTime: "0700",
							LastTime: "2300",
							ScheduleType: "Weekday",
							DayType: "Weekday",
							DayName: null,
							Dates: null,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				response({
					TimeStamp: "20260903163000",
					ActiveBusCount: "1",
					activebus: [
						{ vehplate: "vehicle-1", lat: 1.294, lng: 103.774 },
					],
				}),
			)

		const pickupPoints = await fetchNUSPickupPoints("D1")
		const routeTimes = await fetchNUSRouteMinMaxTimes("D1")
		const activeBuses = await fetchNUSActiveBuses("D1")

		expect(pickupPoints).toEqual([
			expect.objectContaining({ busstopcode: "COM3", LongName: "COM 3" }),
		])
		expect(routeTimes).toEqual([
			expect.objectContaining({ Route: "D1", DayName: null, Dates: null }),
		])
		expect(activeBuses).toEqual([
			expect.objectContaining({ vehplate: "vehicle-1" }),
		])

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
			"https://inetapps.nus.edu.sg/univus/api/bus-proxy/pickup-point",
			"https://inetapps.nus.edu.sg/univus/api/bus-proxy/route-min-max-time",
			"https://inetapps.nus.edu.sg/univus/api/bus-proxy/active-bus",
		])
		expect(fetchMock.mock.calls.map(([, options]) => options?.method)).toEqual([
			"POST",
			"POST",
			"POST",
		])
		for (const [, options] of fetchMock.mock.calls) {
			expect(JSON.parse(String(options?.body))).toEqual({
				route_code: "D1",
				token: "sanitized-access-token",
				userid: "sanitized-userid",
				domain: "PUBLIC",
				deviceid: "sanitized-deviceid",
				ipaddr: "",
				version: "",
			})
		}
	})

	it("rejects an invalid-key application response", async () => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(response({}, "10000", "Invalid API Key"))

		await expect(fetchNUSShuttleService("COM3")).rejects.toThrow("Invalid API Key")
		expect(fetchMock).toHaveBeenCalledOnce()
	})

	it("rejects non-success application codes even when HTTP succeeds", async () => {
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			response({}, "20001", "Upstream unavailable"),
		)

		await expect(fetchNUSShuttleService("COM3")).rejects.toThrow(
			"Upstream unavailable",
		)
	})

	it.each([401, 403])("reports HTTP %s without retrying the configured key", async (status) => {
		const fetchMock = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response(null, { status }))

		await expect(fetchNUSShuttleService("COM3")).rejects.toThrow(`HTTP ${status}`)
		expect(fetchMock).toHaveBeenCalledOnce()
	})

	it("fails before making a request when NUS_ETA_TOKEN is missing", async () => {
		vi.stubEnv("NUS_ETA_TOKEN", "")
		const fetchMock = vi.spyOn(globalThis, "fetch")

		await expect(fetchNUSShuttleService("COM3")).rejects.toThrow(
			"NUS_ETA_TOKEN is not configured",
		)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("fails before making a request when the Univus session is unavailable", async () => {
		mocks.getUnivusSession.mockResolvedValue(null)
		const fetchMock = vi.spyOn(globalThis, "fetch")

		await expect(fetchNUSShuttleService("COM3")).rejects.toThrow(
			"Failed to fetch Univus session",
		)
		expect(fetchMock).not.toHaveBeenCalled()
	})
})
