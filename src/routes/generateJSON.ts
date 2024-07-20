import { createRouteSpec } from "koa-zod-router"
import { groupBy } from "lodash"
import { z } from "zod"
import { generateBusRoutesJSON } from "../fetchers/bus-routes-fetcher"
import { generateBusServicesJSON } from "../fetchers/bus-services-fetcher"
import { generateBusStopsJSON } from "../fetchers/bus-stops-fetcher"
import { BusRouteStop, BusRouteStopSchema, LTABusRoute } from "../types/bus-route-type"
import {
	BusService,
	BusServiceJSON,
	BusServiceJSONSchema,
	LTABusService,
} from "../types/bus-service-type"
import { BusStop, BusStopJSON, BusStopJSONSchema, LTABusStop } from "../types/bus-stop-type"
import { getBusStopFromCode } from "../utils/bus-stops"
import { writeJSON } from "../utils/write-json"
import { DateTime } from "luxon"

export const generateJSON = createRouteSpec({
	method: "post",
	path: "/generate-json",
	validate: {
		headers: z.object({ secret: z.string() }),
	},
	handler: async (ctx) => {
		const { secret } = ctx.request.headers

		if (secret !== process.env.SECRET) {
			ctx.status = 401
			ctx.body = "Unauthorized"
			return
		}

		try {
			const [busStops, busServices, busRoutes] = await Promise.all([
				generateBusStopsJSON(),
				generateBusServicesJSON(),
				generateBusRoutesJSON(),
			])

			if (!busStops || !busServices || !busRoutes) {
				console.log("Something undefined")
				throw new Error()
			}

			const transformedBusStops = await transformBusStops(busStops, busRoutes)

			await writeJSON("bus-stops", transformedBusStops)

			const transformedBusServices = await transformBusServices(
				busRoutes,
				busServices,
				transformedBusStops.data,
			)

			await writeJSON("bus-services", transformedBusServices)

			ctx.status = 201
			ctx.body = {
				message: "JSON files generated",
			}

			setTimeout(() => {
				console.log("Restarting server...")
				process.exit()
			}, 5000)
		} catch (e) {
			ctx.status = 500
			ctx.body = "Internal Server Error"
			return
		}
	},
})

async function transformBusStops(
	busStops: LTABusStop[],
	busRoutes: LTABusRoute[],
): Promise<BusStopJSON> {
	const tempBusStops: BusStop[] = []

	for (const v of busStops) {
		const services = busRoutes.flatMap((route) => {
			if (route.BusStopCode === v.BusStopCode) {
				return route.ServiceNo
			} else {
				return []
			}
		})

		const busStop: BusStop = {
			code: v.BusStopCode,
			name: v.Description,
			roadName: v.RoadName,
			latitude: v.Latitude,
			longitude: v.Longitude,
			services: [...new Set(services)],
		}

		tempBusStops.push(busStop)
	}

	const parsedBusStops = await BusStopJSONSchema.safeParseAsync({
		metadata: DateTime.now().toISO(),
		data: tempBusStops,
	})

	if (!parsedBusStops.success) {
		console.error(`❌ Error parsing bus stops: ${parsedBusStops.error}`)
		throw new Error("Error parsing bus stops")
	}

	return parsedBusStops.data
}

async function transformBusServices(
	busRoutes: LTABusRoute[],
	busServices: LTABusService[],
	busStopData: BusStop[],
): Promise<BusServiceJSON> {
	const tempBusServices: BusService[] = []

	for (const [i, v] of busServices.entries()) {
		if (i !== 0 && busServices[i - 1].ServiceNo === v.ServiceNo) {
			continue
		}

		const parsedBusRoutes = busRoutes.flatMap((route) => {
			if (route.ServiceNo === v.ServiceNo) {
				const busStop = getBusStopFromCode(route.BusStopCode, busStopData)

				return {
					busStop: {
						code: route.BusStopCode,
						name: busStop?.name ?? "",
						roadName: busStop?.roadName ?? "",
						latitude: busStop?.latitude ?? 0,
						longitude: busStop?.longitude ?? 0,
					},
					direction: route.Direction,
					sequence: route.StopSequence,
					distance: route.Distance,
					firstBus: {
						weekdays: route.WD_FirstBus.split("").toSpliced(2, 0, ":").join(""),
						saturday: route.SAT_FirstBus.split("").toSpliced(2, 0, ":").join(""),
						sunday: route.SUN_FirstBus.split("").toSpliced(2, 0, ":").join(""),
					},
					lastBus: {
						weekdays: route.WD_LastBus.split("").toSpliced(2, 0, ":").join(""),
						saturday: route.SAT_LastBus.split("").toSpliced(2, 0, ":").join(""),
						sunday: route.SUN_LastBus.split("").toSpliced(2, 0, ":").join(""),
					},
				} satisfies BusRouteStop
			} else {
				return []
			}
		})

		const routes = Object.values(groupBy(parsedBusRoutes, "direction"))

		const parsed = await z.array(z.array(BusRouteStopSchema)).safeParseAsync(routes)

		if (!parsed.success) {
			console.error(`❌ Error parsing bus route: ${parsed.error}`)
			throw new Error("Error parsing bus route")
		}

		const originBusStopInfo = getBusStopFromCode(v.OriginCode, busStopData)
		const destinationBusStopInfo = getBusStopFromCode(v.DestinationCode, busStopData)

		const busService: BusService = {
			serviceNo: v.ServiceNo,
			interchanges: [
				{
					code: v.OriginCode,
					name: originBusStopInfo?.name ?? "",
					roadName: originBusStopInfo?.roadName ?? "",
					latitude: originBusStopInfo?.latitude ?? 0,
					longitude: originBusStopInfo?.longitude ?? 0,
				},
				{
					code: v.DestinationCode,
					name: destinationBusStopInfo?.name ?? "",
					roadName: destinationBusStopInfo?.roadName ?? "",
					latitude: destinationBusStopInfo?.latitude ?? 0,
					longitude: destinationBusStopInfo?.longitude ?? 0,
				},
			],
			operator: v.Operator,
			isLoopService: v.LoopDesc !== "",
			isSingleRoute: routes.length === 1,
			routes,
		}

		tempBusServices.push(busService)
	}

	const parsedBusServices = await BusServiceJSONSchema.safeParseAsync({
		metadata: DateTime.now().toISO(),
		data: tempBusServices,
	})

	if (!parsedBusServices.success) {
		console.error(`❌ Error parsing bus service: ${parsedBusServices.error}`)
		throw new Error("Error parsing bus service")
	}

	return parsedBusServices.data
}
