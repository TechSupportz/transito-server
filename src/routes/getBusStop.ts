import { z } from "zod"
import { getBusStopFromCode } from "@utils/bus-stops"
import { defineRoute } from "@utils/route-builder"

export const getBusStop = defineRoute({
	method: "get",
	path: "/bus-stop/:code",
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
			message: "Bus stop found",
			data: busStop,
		}
	},
})
