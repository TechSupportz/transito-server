import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	busStops: [
		{
			code: "10002",
			name: "Mid Stop",
			roadName: "Middle Rd",
			latitude: 1.31,
			longitude: 103.81,
			services: ["10"],
			sources: { LTA: "10002" },
			searchTags: [],
		},
	],
	busServices: [
		{
			serviceNo: "10",
			operator: "SBST",
			isLoopService: false,
			isSingleRoute: false,
			interchanges: [
				{
					code: "10001",
					name: "Origin A",
					roadName: "Origin Rd",
					latitude: 1.3,
					longitude: 103.8,
					sources: { LTA: "10001" },
				},
				{
					code: "10003",
					name: "Origin B",
					roadName: "Destination Rd",
					latitude: 1.32,
					longitude: 103.82,
					sources: { LTA: "10003" },
				},
			],
			routes: [
				[
					{
						busStop: {
							code: "10001",
							name: "Origin A",
							roadName: "Origin Rd",
							latitude: 1.3,
							longitude: 103.8,
							sources: { LTA: "10001" },
						},
						direction: 1,
						sequence: 1,
						distance: 0,
						firstBus: { weekdays: "05:30", saturday: "06:00", sunday: "07:00" },
						lastBus: { weekdays: "23:30", saturday: "23:00", sunday: "22:30" },
					},
					{
						busStop: {
							code: "10002",
							name: "Mid Stop",
							roadName: "Middle Rd",
							latitude: 1.31,
							longitude: 103.81,
							sources: { LTA: "10002" },
						},
						direction: 1,
						sequence: 2,
						distance: 1.2,
						firstBus: { weekdays: "05:35", saturday: "06:05", sunday: "07:05" },
						lastBus: { weekdays: "23:35", saturday: "23:05", sunday: "22:35" },
					},
					{
						busStop: {
							code: "10003",
							name: "Origin B",
							roadName: "Destination Rd",
							latitude: 1.32,
							longitude: 103.82,
							sources: { LTA: "10003" },
						},
						direction: 1,
						sequence: 3,
						distance: 2.4,
						firstBus: { weekdays: "05:40", saturday: "06:10", sunday: "07:10" },
						lastBus: { weekdays: "23:40", saturday: "23:10", sunday: "22:40" },
					},
				],
				[
					{
						busStop: {
							code: "10003",
							name: "Origin B",
							roadName: "Destination Rd",
							latitude: 1.32,
							longitude: 103.82,
							sources: { LTA: "10003" },
						},
						direction: 2,
						sequence: 1,
						distance: 0,
						firstBus: { weekdays: "05:45", saturday: "06:15", sunday: "07:15" },
						lastBus: { weekdays: "23:45", saturday: "23:15", sunday: "22:45" },
					},
					{
						busStop: {
							code: "10002",
							name: "Mid Stop",
							roadName: "Middle Rd",
							latitude: 1.31,
							longitude: 103.81,
							sources: { LTA: "10002" },
						},
						direction: 2,
						sequence: 2,
						distance: 1.2,
						firstBus: { weekdays: "05:50", saturday: "06:20", sunday: "07:20" },
						lastBus: { weekdays: "23:50", saturday: "23:20", sunday: "22:50" },
					},
					{
						busStop: {
							code: "10001",
							name: "Origin A",
							roadName: "Origin Rd",
							latitude: 1.3,
							longitude: 103.8,
							sources: { LTA: "10001" },
						},
						direction: 2,
						sequence: 3,
						distance: 2.4,
						firstBus: { weekdays: "05:55", saturday: "06:25", sunday: "07:25" },
						lastBus: { weekdays: "23:55", saturday: "23:25", sunday: "22:55" },
					},
				],
			],
		},
	],
}))

vi.mock("@json", () => ({
	busStops: mocks.busStops,
	busServices: mocks.busServices,
}))

import { getBusStopServices } from "@routes/getBusStopServices"

describe("getBusStopServices", () => {
	it("returns one service interchange for each service route serving the bus stop", async () => {
		const ctx = {
			params: { code: "10002" },
			query: {},
			status: 0,
			body: undefined as unknown,
		}

		await getBusStopServices.handler(ctx as Parameters<typeof getBusStopServices.handler>[0])

		expect(ctx.status).toBe(200)
		expect(ctx.body).toEqual({
			count: 2,
			data: [
				{
					serviceNo: "10",
					originStopCode: "10001",
					destinationStopCode: "10003",
					direction: 1,
				},
				{
					serviceNo: "10",
					originStopCode: "10003",
					destinationStopCode: "10001",
					direction: 2,
				},
			],
		})
	})

	it("returns 404 when the bus stop does not exist", async () => {
		const ctx = {
			params: { code: "99999" },
			query: {},
			status: 0,
			body: undefined as unknown,
		}

		await getBusStopServices.handler(ctx as Parameters<typeof getBusStopServices.handler>[0])

		expect(ctx.status).toBe(404)
		expect(ctx.body).toEqual({ message: "Bus stop not found" })
	})
})
