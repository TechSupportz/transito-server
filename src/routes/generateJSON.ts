import { createRouteSpec } from "koa-zod-router"
import { groupBy } from "lodash"
import { DateTime } from "luxon"
import { z } from "zod"
import { generateBusRoutesJSON } from "../fetchers/bus-routes-fetcher"
import { generateBusServicesJSON } from "../fetchers/bus-services-fetcher"
import { generateBusStopsJSON } from "../fetchers/bus-stops-fetcher"
import { TBusRouteStop, BusRouteStopSchema, TLTABusRoute } from "../types/bus-route-type"
import {
	TBusService,
	TBusServiceJSON,
	BusServiceJSONSchema,
	TLTABusService,
} from "../types/bus-service-type"
import {
	TBusStopJSON,
	BusStopJSONSchema,
	TLTABusStop,
	TTaggedBusStop,
} from "../types/bus-stop-type"
import { generateSearchTags, getBusStopFromCode } from "../utils/bus-stops"
import { writeJSON } from "../utils/write-json"

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
	busStops: TLTABusStop[],
	busRoutes: TLTABusRoute[],
): Promise<TBusStopJSON> {
	const tempBusStops: TTaggedBusStop[] = []

	for (const v of busStops) {
		const services = busRoutes.flatMap((route) => {
			if (route.BusStopCode === v.BusStopCode) {
				return route.ServiceNo
			} else {
				return []
			}
		})
		const searchTags = generateSearchTags(v.Description)

		const busStop: TTaggedBusStop = {
			code: v.BusStopCode,
			name: v.Description,
			roadName: v.RoadName,
			latitude: v.Latitude,
			longitude: v.Longitude,
			services: [...new Set(services)],
			searchTags,
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
	busRoutes: TLTABusRoute[],
	busServices: TLTABusService[],
	busStopData: TTaggedBusStop[],
): Promise<TBusServiceJSON> {
	const tempBusServices: TBusService[] = []

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
				} satisfies TBusRouteStop
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

		const busService: TBusService = {
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
