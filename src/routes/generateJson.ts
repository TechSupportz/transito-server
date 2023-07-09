import { createRouteSpec } from "koa-zod-router"
import { z } from "zod"
import { generateBusStopsJSON } from "../generators/bus-stops"
import { generateBusServicesJSON } from "../generators/bus-services"
import { generateBusRoutesJSON } from "../generators/bus-routes"
import { BusRouteStop, BusRouteStopSchema, LTABusRoute } from "../types/bus-route-type"
import { BusService, LTABusService } from "../types/bus-service-type"
import { LTABusStop } from "../types/bus-stop-type"
import { groupBy } from "lodash"

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

			const res = await transformBusServices(busStops, busRoutes, busServices)

			ctx.status = 200
			ctx.body = {
				message: "JSON files generated",
				res,
			}
		} catch (e) {
			ctx.status = 500
			ctx.body = "Internal Server Error"
		}
	},
})

async function transformBusServices(
	busStops: LTABusStop[],
	busRoutes: LTABusRoute[],
	busServices: LTABusService[],
): Promise<any> {
	const tempBusServices: BusService[] = []

	let test: any = []

	for (const [i, v] of busServices.entries()) {
		if (i !== 0 && busServices[i - 1].ServiceNo === v.ServiceNo) {
			continue
		}

		const routes = Object.values(
			groupBy(
				busRoutes.flatMap((route) => {
					if (route.ServiceNo === v.ServiceNo) {
						return {
							busStop: {
								code: route.BusStopCode,
								// TODO: create a function to get the bus stop name when provided with the bus stop code
								name: "placeholder",
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
				}),
				"direction",
			),
		)

		const parsed = await z.array(z.array(BusRouteStopSchema)).safeParseAsync(routes)

		if (!parsed.success) {
			console.error(`❌ Error parsing bus route: ${parsed.error}`)
		}

		test.push({ serviceNum: v.ServiceNo, routes })
	}

	return test	
}
