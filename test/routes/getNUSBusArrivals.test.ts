import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { TNUSShuttle } from "@app-types/univus-type"

const mocks = vi.hoisted(() => ({
	fetchNUSActiveBuses: vi.fn(),
	fetchNUSShuttleService: vi.fn(),
	getBusServiceFromServiceNo: vi.fn(),
}))

vi.mock("@fetchers/nus-eta-fetcher", () => ({
	fetchNUSActiveBuses: mocks.fetchNUSActiveBuses,
	fetchNUSShuttleService: mocks.fetchNUSShuttleService,
}))

vi.mock("@utils/bus-services", () => ({
	getBusServiceFromServiceNo: mocks.getBusServiceFromServiceNo,
}))

import { getNUSBusArrivals } from "@routes/univus/getNUSBusArrivals"
import { UpstreamError } from "@utils/upstream-error"
import {
	A1_ROUTE,
	APPROACHING_FIRST_UHALL_OPP,
	APPROACHING_SECOND_UHALL_OPP,
	K_ROUTE,
	UHALL_OPP,
} from "../fixtures/nus-routes"

const makeShuttle = (name: string, etas: TNUSShuttle["_etas"]): TNUSShuttle => ({
	name,
	routeid: 1,
	busstopcode: "KR-MRT",
	_etas: etas,
	arrivalTime: "",
	nextArrivalTime: "",
	passengers: "",
	nextPassengers: "",
	arrivalTime_veh_plate: "",
	nextArrivalTime_veh_plate: "",
})

const makeEta = (plate: string, eta: number): TNUSShuttle["_etas"][number] => ({
	eta,
	eta_s: eta * 60,
	ts: "",
	plate,
	jobid: 1,
	px: "",
})

const makeActiveBus = (vehplate: string, location: { latitude: number; longitude: number }) => ({
	vehplate,
	lat: location.latitude,
	lng: location.longitude,
})

async function getVisitNumbers(code: string) {
	const ctx = { params: { code }, status: 0, body: undefined as unknown }

	await getNUSBusArrivals.handler(ctx as Parameters<typeof getNUSBusArrivals.handler>[0])

	expect(ctx.status).toBe(200)
	const body = ctx.body as {
		Services: {
			NextBus: { VisitNumber: string }
			NextBus2: { VisitNumber: string }
			NextBus3: { VisitNumber: string }
		}[]
	}
	const [service] = body.Services
	return [service.NextBus.VisitNumber, service.NextBus2.VisitNumber, service.NextBus3.VisitNumber]
}

type TArrivalServiceResponse = {
	ServiceNo: string
	NextBus: {
		EstimatedArrival: string
		OriginCode: string
		DestinationCode: string
	}
	NextBus2: {
		EstimatedArrival: string
	}
	NextBus3: {
		EstimatedArrival: string
	}
}

describe("getNUSBusArrivals", () => {
	beforeEach(() => {
		vi.resetAllMocks()
		mocks.fetchNUSActiveBuses.mockResolvedValue([])
		mocks.getBusServiceFromServiceNo.mockImplementation((serviceNo: string) => ({
			serviceNo,
			operator: "NUS",
			interchanges: [{ code: "ORIGIN" }, { code: "DESTINATION" }],
		}))
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("reports upstream NUS failures as 502 with the provider", async () => {
		mocks.fetchNUSShuttleService.mockRejectedValue(new UpstreamError("nus", "Invalid API Key"))

		const ctx = { params: { code: "KR-MRT" }, status: 0, body: undefined as unknown }

		await getNUSBusArrivals.handler(ctx as Parameters<typeof getNUSBusArrivals.handler>[0])

		expect(ctx.status).toBe(502)
		expect(ctx.body).toMatchObject({ provider: "nus" })
	})

	it("reports upstream NUS timeouts as 504 so they never count as an Outage", async () => {
		mocks.fetchNUSShuttleService.mockRejectedValue(
			new UpstreamError("nus", "The operation was aborted due to timeout", {
				timedOut: true,
			}),
		)

		const ctx = { params: { code: "KR-MRT" }, status: 0, body: undefined as unknown }

		await getNUSBusArrivals.handler(ctx as Parameters<typeof getNUSBusArrivals.handler>[0])

		expect(ctx.status).toBe(504)
		expect(ctx.body).toMatchObject({ provider: "nus" })
	})

	it("reports its own failures as 500", async () => {
		mocks.fetchNUSShuttleService.mockRejectedValue(new TypeError("boom"))

		const ctx = { params: { code: "KR-MRT" }, status: 0, body: undefined as unknown }

		await getNUSBusArrivals.handler(ctx as Parameters<typeof getNUSBusArrivals.handler>[0])

		expect(ctx.status).toBe(500)
		expect(ctx.body).not.toHaveProperty("provider")
	})

	it("does not return services when NextBus, NextBus2, and NextBus3 are all empty", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-06-01T12:00:00+08:00"))

		mocks.fetchNUSShuttleService.mockResolvedValue([
			makeShuttle("A1", []),
			makeShuttle("D1", [
				{
					eta: 5,
					eta_s: 300,
					ts: "2026-06-01 12:30:00",
					plate: "SBS1A",
					jobid: 1,
					px: "",
				},
			]),
		])

		const ctx = {
			params: { code: "KR-MRT" },
			status: 0,
			body: undefined as unknown,
		}

		await getNUSBusArrivals.handler(ctx as Parameters<typeof getNUSBusArrivals.handler>[0])

		const body = ctx.body as { Services: TArrivalServiceResponse[] }

		expect(ctx.status).toBe(200)
		expect(body.Services).toHaveLength(1)
		expect(body.Services[0].ServiceNo).toBe("D1")
		expect(body.Services[0].NextBus.EstimatedArrival).toBe("2026-06-01T12:05:00+08:00")
		expect(body.Services[0].NextBus.OriginCode).toBe("ORIGIN")
		expect(body.Services[0].NextBus.DestinationCode).toBe("DESTINATION")
		expect(body.Services[0].NextBus2.EstimatedArrival).toBe("")
		expect(body.Services[0].NextBus3.EstimatedArrival).toBe("")
	})

	it("does not return ending terminal shuttle rows", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-06-01T12:00:00+08:00"))

		mocks.fetchNUSShuttleService.mockResolvedValue([
			{
				...makeShuttle("D1", [
					{
						eta: 1,
						eta_s: 55,
						ts: "2026-06-01 12:01:00",
						plate: "PD533T",
						jobid: 1,
						px: "",
					},
				]),
				busstopcode: "COM3-D1-E",
			},
			makeShuttle("A1", [
				{
					eta: 5,
					eta_s: 300,
					ts: "2026-06-01 12:05:00",
					plate: "SBS1A",
					jobid: 2,
					px: "",
				},
			]),
		])

		const ctx = {
			params: { code: "COM3" },
			status: 0,
			body: undefined as unknown,
		}

		await getNUSBusArrivals.handler(ctx as Parameters<typeof getNUSBusArrivals.handler>[0])

		const body = ctx.body as { Services: TArrivalServiceResponse[] }

		expect(ctx.status).toBe(200)
		expect(body.Services).toHaveLength(1)
		expect(body.Services[0].ServiceNo).toBe("A1")
		expect(mocks.fetchNUSActiveBuses).toHaveBeenCalledOnce()
		expect(mocks.fetchNUSActiveBuses).toHaveBeenCalledWith("A1")
		expect(mocks.getBusServiceFromServiceNo).toHaveBeenCalledOnce()
		expect(mocks.getBusServiceFromServiceNo).toHaveBeenCalledWith("A1")
	})

	it("formats arrival timestamps from ETA minutes rounded to the nearest minute", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-06-01T12:00:31+08:00"))

		mocks.fetchNUSShuttleService.mockResolvedValue([
			makeShuttle("A1", [
				{
					eta: 1,
					eta_s: 60,
					ts: "2026-06-01 11:54:59",
					plate: "SBS1A",
					jobid: 1,
					px: "",
				},
				{
					eta: 2,
					eta_s: 120,
					ts: "2026-06-01 11:55:00",
					plate: "SBS2A",
					jobid: 2,
					px: "",
				},
				{
					eta: 5,
					eta_s: 300,
					ts: "2026-06-01 12:05:00",
					plate: "SBS3A",
					jobid: 3,
					px: "",
				},
				{
					eta: 10,
					eta_s: 600,
					ts: "2026-06-01 12:10:00",
					plate: "SBS4A",
					jobid: 4,
					px: "",
				},
				{
					eta: 15,
					eta_s: 900,
					ts: "2026-06-01 12:15:00",
					plate: "SBS5A",
					jobid: 5,
					px: "",
				},
			]),
		])

		const ctx = {
			params: { code: "KR-MRT" },
			status: 0,
			body: undefined as unknown,
		}

		await getNUSBusArrivals.handler(ctx as Parameters<typeof getNUSBusArrivals.handler>[0])

		const body = ctx.body as { Services: TArrivalServiceResponse[] }

		expect(ctx.status).toBe(200)
		expect(body.Services).toHaveLength(1)
		expect(body.Services[0].NextBus.EstimatedArrival).toBe("2026-06-01T12:02:00+08:00")
		expect(body.Services[0].NextBus2.EstimatedArrival).toBe("2026-06-01T12:03:00+08:00")
		expect(body.Services[0].NextBus3.EstimatedArrival).toBe("2026-06-01T12:06:00+08:00")
	})

	describe("VisitNumber", () => {
		beforeEach(() => {
			mocks.getBusServiceFromServiceNo.mockImplementation((serviceNo: string) => ({
				serviceNo,
				operator: "NUS",
				interchanges: [{ code: "ORIGIN" }, { code: "DESTINATION" }],
				routes: [serviceNo === "A1" ? A1_ROUTE : K_ROUTE],
			}))
		})

		it("tells K's two visits to UHALL-OPP apart, and leaves a bus at the stop blank", async () => {
			mocks.fetchNUSShuttleService.mockResolvedValue([
				makeShuttle("K", [
					makeEta("FIRST", 1),
					makeEta("SECOND", 3),
					makeEta("AT-STOP", 8),
				]),
			])
			mocks.fetchNUSActiveBuses.mockResolvedValue([
				makeActiveBus("FIRST", APPROACHING_FIRST_UHALL_OPP),
				makeActiveBus("SECOND", APPROACHING_SECOND_UHALL_OPP),
				makeActiveBus("AT-STOP", UHALL_OPP),
			])

			expect(await getVisitNumbers("UHALL-OPP")).toEqual(["1", "2", ""])
		})

		it("leaves a repeated stop blank when the bus has no live location", async () => {
			mocks.fetchNUSShuttleService.mockResolvedValue([
				makeShuttle("K", [makeEta("UNTRACKED", 2)]),
			])

			expect(await getVisitNumbers("UHALL-OPP")).toEqual(["", "", ""])
		})

		it("still returns the arrival with a blank visit when the route data is missing", async () => {
			mocks.getBusServiceFromServiceNo.mockReturnValue(undefined)
			mocks.fetchNUSShuttleService.mockResolvedValue([
				makeShuttle("K", [makeEta("FIRST", 1)]),
			])
			mocks.fetchNUSActiveBuses.mockResolvedValue([
				makeActiveBus("FIRST", APPROACHING_FIRST_UHALL_OPP),
			])

			expect(await getVisitNumbers("UHALL-OPP")).toEqual(["", "", ""])
		})

		it("counts a departure from a loop terminal as visit 1", async () => {
			mocks.fetchNUSShuttleService.mockResolvedValue([
				makeShuttle("A1", [makeEta("DEPARTING", 4)]),
			])

			expect(await getVisitNumbers("KRB")).toEqual(["1", "", ""])
		})

		it("counts a non-repeated stop as visit 1", async () => {
			mocks.fetchNUSShuttleService.mockResolvedValue([makeShuttle("K", [makeEta("ANY", 4)])])
			mocks.fetchNUSActiveBuses.mockResolvedValue([
				makeActiveBus("ANY", APPROACHING_SECOND_UHALL_OPP),
			])

			expect(await getVisitNumbers("YIH")).toEqual(["1", "", ""])
		})
	})
})
