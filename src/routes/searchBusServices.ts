import { createRouteSpec } from "koa-zod-router"
import MiniSearch from "minisearch"
import { z } from "zod"
import { busServices } from "../json"

export const searchBusServices = createRouteSpec({
	method: "get",
	path: "/search/bus-services",
	validate: {
		query: z.object({
			search: z
				.string({ required_error: "Search query is required" })
				.min(1, { message: "Search query must be at least 1 character long" }),
		}),
	},
	handler: async (ctx) => {
		const { search } = ctx.request.query

		const ms = new MiniSearch({
			fields: ["serviceNo"],
			idField: "serviceNo",
			storeFields: ["serviceNo", "operator"],
			searchOptions: {
				prefix: true,
			},
		})

		ms.addAll(busServices)

		const res = ms.search(search)

		if (res.length === 0) {
			ctx.status = 404
			ctx.body = {
				message: "No bus services found",
			}
			return
		}

		const searchResults = res.map((result) => {
			const { id, match, score, terms, ...busServices } = result
			return busServices
		})

		ctx.status = 200
		ctx.body = {
			message: "Bus services found",
			data: searchResults,
		}
		return
	},
})
