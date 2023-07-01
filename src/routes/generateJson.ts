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
			await Promise.all([generateBusStopsJSON(), generateBusServicesJSON()])

			const busRoutes = await generateBusRoutesJSON()

			ctx.status = 200
			ctx.body = {
				message: "JSON files generated",
				// busRoutes,
			}
		} catch (e) {
			ctx.status = 500
			ctx.body = "Internal Server Error"
		}
	},
})
