import { getBusStopFromCode } from "@utils/bus-stops"
import { getBusStopServiceInterchanges } from "@utils/bus-services"
import { defineRoute } from "@utils/route-builder"
import { z } from "zod"

export const getBusStopServices = defineRoute({
	method: "get",
	path: "/bus-stop/:code/services",
	validate: {
		params: z.object({
			code: z.string().min(1, { message: "Bus stop code is required" }),
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

		const serviceInterchanges = getBusStopServiceInterchanges(busStop.code, busStop.services)

		ctx.status = 200
		ctx.body = {
			count: serviceInterchanges.length,
			data: serviceInterchanges,
		}
	},
})
