import { createRouteSpec } from "koa-zod-router"
import { z } from "zod"
import { getBusStopFromCode } from "../utils/bus-stops"
import { setTimeout } from "timers/promises"

export const getBusStopServices = createRouteSpec({
	method: "get",
	path: "/bus-stop/:code/services",
	validate: {
		params: z.object({
			code: z.string().length(5, { message: "Bus stop code must be 5 characters long" }),
		}),
	},
	handler: async (ctx) => {
		const busStop = getBusStopFromCode(ctx.params.code)

		if (!busStop) {
			ctx.status = 404
			ctx.body = {
				message: "Bus stop not found",
			}
			return
		}

		ctx.status = 200
		ctx.body = {
			count: busStop.services.length,
			data: busStop.services,
		}

		// ctx.status = 200
		// ctx.body = {
		// 	count: busStop.services.length,
		// 	data: busStop.services,
		// }
	},
})
