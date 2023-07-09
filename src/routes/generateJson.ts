import { createRouteSpec } from "koa-zod-router"
import { z } from "zod"
import { generateBusStopsJSON } from "../generators/bus-stops"
import { generateBusServicesJSON } from "../generators/bus-services"
import { generateBusRoutesJSON } from "../generators/bus-routes"

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

			// console.log(busStops, busServices, busRoutes)

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
