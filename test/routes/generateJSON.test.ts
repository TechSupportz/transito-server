import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	generateBusRoutesJSON: vi.fn(),
	generateBusServicesJSON: vi.fn(),
	generateBusStopsJSON: vi.fn(),
	fetchNUSPickupPoints: vi.fn(),
	fetchNUSRouteMinMaxTimes: vi.fn(),
	fetchUnivusBusStops: vi.fn(),
	writeJSON: vi.fn(),
}))

vi.mock("@fetchers/bus-routes-fetcher", () => ({
	generateBusRoutesJSON: mocks.generateBusRoutesJSON,
}))

vi.mock("@fetchers/bus-services-fetcher", () => ({
	generateBusServicesJSON: mocks.generateBusServicesJSON,
}))

vi.mock("@fetchers/bus-stops-fetcher", () => ({
	generateBusStopsJSON: mocks.generateBusStopsJSON,
}))

vi.mock("@fetchers/nus-eta-fetcher", () => ({
	fetchNUSPickupPoints: mocks.fetchNUSPickupPoints,
	fetchNUSRouteMinMaxTimes: mocks.fetchNUSRouteMinMaxTimes,
}))

vi.mock("@fetchers/univus-maps-data-fetcher", () => ({
	fetchUnivusBusStops: mocks.fetchUnivusBusStops,
}))

vi.mock("@utils/write-json", () => ({
	writeJSON: mocks.writeJSON,
}))

vi.mock("@utils/nus-mappings", async () => {
	const actual =
		await vi.importActual<typeof import("../../src/utils/nus-mappings")>(
			"@utils/nus-mappings",
		)

	return {
		...actual,
		NUS_SERVICE_CODES: ["A1"],
	}
})

describe("generateJSON", () => {
	const originalSecret = process.env.SECRET

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2024-01-02T03:04:05.000Z"))
		vi.resetAllMocks()

		process.env.SECRET = "test-secret"
		mocks.writeJSON.mockResolvedValue(undefined)
	})

	afterEach(() => {
		vi.useRealTimers()
		process.env.SECRET = originalSecret
	})

	it("transforms raw bus data and writes generated JSON files", async () => {
		const rawBusStops = [
			{
				BusStopCode: "10001",
				RoadName: "Main Rd",
				Description: "Main Int",
				Latitude: 1.3,
				Longitude: 103.8,
			},
			{
				BusStopCode: "10002",
				RoadName: "Loop Rd",
				Description: "Opp Main Rd",
				Latitude: 1.31,
				Longitude: 103.81,
			},
		]
		const rawBusServices = [
			{
				ServiceNo: "10",
				Operator: "SBST",
				Direction: 1,
				Category: "TRUNK",
				OriginCode: "10001",
				DestinationCode: "10002",
				AM_Peak_Freq: "10",
				AM_Offpeak_Freq: "12",
				PM_Peak_Freq: "10",
				PM_Offpeak_Freq: "12",
				LoopDesc: "",
			},
		]
		const rawBusRoutes = [
			{
				ServiceNo: "10",
				Operator: "SBST",
				Direction: 1,
				StopSequence: 1,
				BusStopCode: "10001",
				Distance: 0,
				WD_FirstBus: "0530",
				WD_LastBus: "2330",
				SAT_FirstBus: "0600",
				SAT_LastBus: "2300",
				SUN_FirstBus: "0700",
				SUN_LastBus: "2230",
			},
			{
				ServiceNo: "10",
				Operator: "SBST",
				Direction: 1,
				StopSequence: 2,
				BusStopCode: "10002",
				Distance: 1.2,
				WD_FirstBus: "0535",
				WD_LastBus: "2335",
				SAT_FirstBus: "0605",
				SAT_LastBus: "2305",
				SUN_FirstBus: "0705",
				SUN_LastBus: "2235",
			},
		]
		const nusPickupPoints = [
			{
				routeid: 1,
				seq: 1,
				pickupname: "A1 Pickup 1",
				LongName: "A1 Long 1",
				ShortName: "A1 Short 1",
				busstopcode: "NUS1",
				lat: 1.2,
				lng: 103.7,
			},
			{
				routeid: 1,
				seq: 2,
				pickupname: "A1 Pickup 2",
				LongName: "A1 Long 2",
				ShortName: "A1 Short 2",
				busstopcode: "NUS2",
				lat: 1.21,
				lng: 103.71,
			},
		]
		const nusTimes = [
			{
				DisplayOrder: "1",
				Route: "A1",
				FirstTime: "0700",
				LastTime: "2300",
				ScheduleType: "Regular",
				DayType: "Mon-Fri",
			},
			{
				DisplayOrder: "2",
				Route: "A1",
				FirstTime: "0800",
				LastTime: "2200",
				ScheduleType: "Regular",
				DayType: "Sat",
			},
			{
				DisplayOrder: "3",
				Route: "A1",
				FirstTime: "0900",
				LastTime: "2100",
				ScheduleType: "Regular",
				DayType: "Sun",
			},
		]
		const univusBusStops = [
			{
				category: ["bus_stop"],
				code: "NUS1",
				name: "Univus NUS1",
				title: "A1 Title 1",
				longitude: 103.72,
				latitude: 1.22,
				id: "univus-nus-1",
			},
			{
				category: ["bus_stop"],
				code: "NUS2",
				name: "Univus NUS2",
				title: "A1 Title 2",
				longitude: 103.73,
				latitude: 1.23,
				id: "univus-nus-2",
			},
		]

		mocks.generateBusStopsJSON.mockResolvedValue(rawBusStops)
		mocks.generateBusServicesJSON.mockResolvedValue(rawBusServices)
		mocks.generateBusRoutesJSON.mockResolvedValue(rawBusRoutes)
		mocks.fetchUnivusBusStops.mockResolvedValue(univusBusStops)
		mocks.fetchNUSPickupPoints.mockResolvedValue(nusPickupPoints)
		mocks.fetchNUSRouteMinMaxTimes.mockResolvedValue(nusTimes)

		const { generateJSON } = await import("../../src/routes/generateJSON")
		const ctx = {
			request: {
				headers: {
					secret: "test-secret",
				},
			},
		} as any

		await generateJSON.handler(ctx)

		expect(ctx.status).toBe(201)
		expect(ctx.body).toEqual({ message: "JSON files generated" })
		expect(mocks.writeJSON).toHaveBeenCalledTimes(2)
		expect(mocks.writeJSON).toHaveBeenNthCalledWith(1, "bus-stops", {
			metadata: expect.any(String),
			data: [
				{
					code: "10001",
					name: "Main Int",
					roadName: "Main Rd",
					latitude: 1.3,
					longitude: 103.8,
					services: ["10"],
					sources: { LTA: "10001" },
					searchTags: ["interchange"],
				},
				{
					code: "10002",
					name: "Opp Main Rd",
					roadName: "Loop Rd",
					latitude: 1.31,
					longitude: 103.81,
					services: ["10"],
					sources: { LTA: "10002" },
					searchTags: ["opposite", "road"],
				},
				{
					code: "NUS1",
					name: "A1 Title 1",
					roadName: "",
					latitude: 1.22,
					longitude: 103.72,
					services: ["A1"],
					sources: { NUS: "NUS1" },
					searchTags: [
						"NUS1",
						"A1 Pickup 1",
						"A1 Long 1",
						"A1 Short 1",
						"NUS1",
						"Univus NUS1",
						"A1 Title 1",
					],
				},
				{
					code: "NUS2",
					name: "A1 Title 2",
					roadName: "",
					latitude: 1.23,
					longitude: 103.73,
					services: ["A1"],
					sources: { NUS: "NUS2" },
					searchTags: [
						"NUS2",
						"A1 Pickup 2",
						"A1 Long 2",
						"A1 Short 2",
						"NUS2",
						"Univus NUS2",
						"A1 Title 2",
					],
				},
			],
		})
		expect(mocks.writeJSON).toHaveBeenNthCalledWith(2, "bus-services", {
			metadata: expect.any(String),
			data: [
				{
					serviceNo: "10",
					interchanges: [
						{
							code: "10001",
							name: "Main Int",
							roadName: "Main Rd",
							latitude: 1.3,
							longitude: 103.8,
							sources: { LTA: "10001" },
						},
						{
							code: "10002",
							name: "Opp Main Rd",
							roadName: "Loop Rd",
							latitude: 1.31,
							longitude: 103.81,
							sources: { LTA: "10002" },
						},
					],
					operator: "SBST",
					isLoopService: false,
					isSingleRoute: true,
					routes: [
						[
							{
								busStop: {
									code: "10001",
									name: "Main Int",
									roadName: "Main Rd",
									latitude: 1.3,
									longitude: 103.8,
									sources: { LTA: "10001" },
								},
								direction: 1,
								sequence: 1,
								distance: 0,
								firstBus: {
									weekdays: "05:30",
									saturday: "06:00",
									sunday: "07:00",
								},
								lastBus: {
									weekdays: "23:30",
									saturday: "23:00",
									sunday: "22:30",
								},
							},
							{
								busStop: {
									code: "10002",
									name: "Opp Main Rd",
									roadName: "Loop Rd",
									latitude: 1.31,
									longitude: 103.81,
									sources: { LTA: "10002" },
								},
								direction: 1,
								sequence: 2,
								distance: 1.2,
								firstBus: {
									weekdays: "05:35",
									saturday: "06:05",
									sunday: "07:05",
								},
								lastBus: {
									weekdays: "23:35",
									saturday: "23:05",
									sunday: "22:35",
								},
							},
						],
					],
				},
				{
					serviceNo: "A1",
					interchanges: [
						{
							code: "NUS1",
							name: "A1 Title 1",
							roadName: "",
							latitude: 1.22,
							longitude: 103.72,
							sources: { NUS: "NUS1" },
						},
						{
							code: "NUS2",
							name: "A1 Title 2",
							roadName: "",
							latitude: 1.23,
							longitude: 103.73,
							sources: { NUS: "NUS2" },
						},
					],
					operator: "NUS",
					isLoopService: false,
					isSingleRoute: true,
					routes: [
						[
							{
								busStop: {
									code: "NUS1",
									name: "A1 Title 1",
									roadName: "",
									latitude: 1.22,
									longitude: 103.72,
									sources: { NUS: "NUS1" },
								},
								direction: 1,
								sequence: 1,
								distance: 0,
								firstBus: {
									weekdays: "0700",
									saturday: "0800",
									sunday: "0900",
								},
								lastBus: {
									weekdays: "2300",
									saturday: "2200",
									sunday: "2100",
								},
							},
							{
								busStop: {
									code: "NUS2",
									name: "A1 Title 2",
									roadName: "",
									latitude: 1.23,
									longitude: 103.73,
									sources: { NUS: "NUS2" },
								},
								direction: 1,
								sequence: 2,
								distance: 0,
								firstBus: {
									weekdays: "0700",
									saturday: "0800",
									sunday: "0900",
								},
								lastBus: {
									weekdays: "2300",
									saturday: "2200",
									sunday: "2100",
								},
							},
						],
					],
				},
			],
		})
	})
})
