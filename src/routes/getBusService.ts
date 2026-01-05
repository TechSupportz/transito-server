import { z } from "zod"
import { getBusServiceFromServiceNo } from "@utils/bus-services"
import { defineRoute } from "@utils/route-builder"

export const getBusService = defineRoute({
	method: "get",
	path: "/bus-service/:serviceNo",
	validate: {
		params: z.object({
			serviceNo: z.string(),
		}),
		query: z.object({
			includeRoutes: z.string().optional(),
		}),
	},
	handler: async (ctx) => {
		const { serviceNo } = ctx.params
		const includeRoutes = ctx.query.includeRoutes === ""

		const busService = getBusServiceFromServiceNo(serviceNo)

		if (!busService) {
			ctx.status = 404
			ctx.body = {
				message: "Bus service not found",
			}
			return
		}

		if (!includeRoutes) {
			const { routes, ...busServiceWithoutRoutes } = busService

			ctx.status = 200
			ctx.body = {
				message: "Bus service found without routes",
				data: busServiceWithoutRoutes,
			}
			return
		}

		ctx.status = 200
		ctx.body = {
			message: "Bus service found",
			data: busService,
		}
		return
	},
})
