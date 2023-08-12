import { createRouteSpec } from "koa-zod-router"
import MiniSearch from "minisearch"
import { z } from "zod"
import { BusStop } from "../types/bus-stop-type"
import { busStops } from "../json"
import { isBusStopCode } from "../utils/bus-stops"

export const searchBusStops = createRouteSpec({
	method: "get",
	path: "/search/bus-stops",
	validate: {
		query: z.object({
			search: z.string({ required_error: "Search query is required" }),
		}),
	},
	handler: async (ctx) => {
		const { search } = ctx.request.query

		const ms = new MiniSearch({
			fields: ["name", "roadName", "code"],
			idField: "code",
			storeFields: ["name", "roadName", "code"],
			searchOptions: {
				fuzzy: (term) =>
					term.toLowerCase().includes("blk") || isBusStopCode(term) ? false : 0.2,
				prefix: (term) =>
					term.toLowerCase().includes("blk") ||
					term.toLowerCase().includes("opp") ||
					isBusStopCode(term)
						? false
						: true,
				combineWith: "AND",
				boost: { name: 2, roadName: 1 },
			},
		})

		ms.addAll(busStops)

		const res = ms.search(search)

		if (res.length === 0) {
			ctx.status = 404
			ctx.body = {
				message: "No bus stops found",
			}
			return
		}

		const searchResults = res.map((result) => {
			const { id, match, score, terms, ...busStops } = result
			return busStops
		})

		ctx.status = 200
		ctx.body = {
			message: "Bus stops found",
			data: searchResults,
		}
		return
	},
})
