import { createRouteSpec } from "koa-zod-router"
import { z } from "zod"
import { generateBusStopsJson } from "../generators/bus-stops"
import { generateBusServicesJson } from "../generators/bus-services"

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
			await Promise.all([generateBusStopsJson(), generateBusServicesJson()])

			ctx.status = 200
			ctx.body = "Generated JSON files"
		} catch (e) {
			ctx.status = 500
			ctx.body = "Internal Server Error"
		}
	},
})
