import { writeFile } from "fs"
import { createRouteSpec } from "koa-zod-router"
import { groupBy } from "lodash"
import { z } from "zod"
import { generateBusRoutesJSON } from "../fetchers/bus-routes-fetcher"
import { generateBusServicesJSON } from "../fetchers/bus-services-fetcher"
import { generateBusStopsJSON } from "../fetchers/bus-stops-fetcher"
import { BusRouteStopSchema, LTABusRoute } from "../types/bus-route-type"
import {
	BusService,
	BusServiceJSON,
	BusServiceJSONSchema,
	LTABusService
} from "../types/bus-service-type"
import { getBusStopFromCode } from "../utils/bus-stops"

export const generateJsonRoute = createRouteSpec({
	method: "post",
	path: "/generateJson",
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

			const res = await transformBusServices(busRoutes, busServices)

			writeFile("./src/json/bus_services.json", JSON.stringify(res), (err) => {
				if (err) {
					console.error("❌ Error writing bus services file", err)
					Promise.reject(err)
					throw err
				} else {
					console.log("📄 Bus Service JSON file generated")
					Promise.resolve()
				}
			})

			ctx.status = 200
			ctx.body = {
				message: "JSON files generated",
			}
		} catch (e) {
			ctx.status = 500
			ctx.body = "Internal Server Error"
		}
	},
})

async function transformBusServices(
	busRoutes: LTABusRoute[],
	busServices: LTABusService[],
): Promise<BusServiceJSON> {
	const tempBusServices: BusService[] = []

	for (const [i, v] of busServices.entries()) {
		if (i !== 0 && busServices[i - 1].ServiceNo === v.ServiceNo) {
			continue
		}

		const parsedBusRoutes = busRoutes.flatMap((route) => {
			if (route.ServiceNo === v.ServiceNo) {
				const busStop = getBusStopFromCode(route.BusStopCode)

				return {
					busStop: {
						code: route.BusStopCode,
						name: busStop?.Description ?? "",
					},
					direction: route.Direction,
					sequence: route.StopSequence,
					distance: route.Distance,
					firstBus: {
						weekdays: route.WD_FirstBus,
						saturday: route.SAT_FirstBus,
						sunday: route.SUN_FirstBus,
					},
					lastBus: {
						weekdays: route.WD_LastBus,
						saturday: route.SAT_LastBus,
						sunday: route.SUN_LastBus,
					},
				}
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

		const busService: BusService = {
			serviceNo: v.ServiceNo,
			interchanges: [
				{
					code: v.OriginCode,
					name: getBusStopFromCode(v.OriginCode)?.Description ?? "",
				},
				{
					code: v.DestinationCode,
					name: getBusStopFromCode(v.DestinationCode)?.Description ?? "",
				},
			],
			operator: v.Operator,
			isLoopService: v.LoopDesc !== "",
			routes,
		}

		tempBusServices.push(busService)
	}

	const parsedBusServices = await BusServiceJSONSchema.safeParseAsync({
		metadata: new Date().toISOString(),
		data: tempBusServices,
	})

	if (!parsedBusServices.success) {
		console.error(`❌ Error parsing bus service: ${parsedBusServices.error}`)
		throw new Error("Error parsing bus service")
	}

	return parsedBusServices.data
}
