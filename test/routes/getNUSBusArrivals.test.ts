import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TNUSShuttle } from "@app-types/univus-type"

const mocks = vi.hoisted(() => ({
	fetchNUSActiveBuses: vi.fn(),
	fetchNUSPickupPoints: vi.fn(),
	fetchNUSShuttleService: vi.fn(),
}))

vi.mock("@fetchers/nus-eta-fetcher", () => ({
	fetchNUSActiveBuses: mocks.fetchNUSActiveBuses,
	fetchNUSPickupPoints: mocks.fetchNUSPickupPoints,
	fetchNUSShuttleService: mocks.fetchNUSShuttleService,
}))

import { getNUSBusArrivals } from "@routes/univus/getNUSBusArrivals"

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

type TArrivalServiceResponse = {
	ServiceNo: string
	NextBus: {
		EstimatedArrival: string
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
		mocks.fetchNUSPickupPoints.mockResolvedValue([])
	})

	it("does not return services when NextBus, NextBus2, and NextBus3 are all empty", async () => {
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

		await getNUSBusArrivals.handler(
			ctx as Parameters<typeof getNUSBusArrivals.handler>[0],
		)

		const body = ctx.body as { Services: TArrivalServiceResponse[] }

		expect(ctx.status).toBe(200)
		expect(body.Services).toHaveLength(1)
		expect(body.Services[0].ServiceNo).toBe("D1")
		expect(body.Services[0].NextBus.EstimatedArrival).toBe("2026-06-01T12:30:00+08:00")
		expect(body.Services[0].NextBus2.EstimatedArrival).toBe("")
		expect(body.Services[0].NextBus3.EstimatedArrival).toBe("")
	})
})
