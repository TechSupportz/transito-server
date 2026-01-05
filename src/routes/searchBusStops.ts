import { isBusStopCode } from "@utils/bus-stops"
import { defineRoute } from "@utils/route-builder"
import MiniSearch from "minisearch"
import { z } from "zod"
import { busStops } from "../json"
import { BasicBusStopSchema } from "../types/bus-stop-type"

export const searchBusStops = defineRoute({
	method: "get",
	path: "/search/bus-stops",
	validate: {
		query: z.object({
			query: z.string({ error: (issues) => issues.message || "Search query is required" }),
		}),
	},
	handler: async (ctx) => {
		const { query } = ctx.request.query

		const ms = new MiniSearch({
			fields: ["name", "roadName", "code", "searchTags"],
			idField: "code",
			storeFields: ["name", "roadName", "code", "latitude", "longitude"],
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
				boost: { name: 2, searchTags: 2, roadName: 1 },
			},
		})

		ms.addAll(busStops)

		const res = ms.search(query)

		if (res.length === 0) {
			ctx.body = {
				message: "No bus stops found",
				count: 0,
				data: [],
			}
			return
		}

		const getSearchResults = async () => {
			const cleanedSearchResults = res.map((result) => {
				const { id, match, score, terms, ...busStops } = result
				return busStops
			})

			const parsedSearchResults = await z
				.array(BasicBusStopSchema)
				.safeParseAsync(cleanedSearchResults)

			if (!parsedSearchResults.success) {
				console.error(
					`❌ Error parsing bus stop search results: ${parsedSearchResults.error}`,
				)
				ctx.status = 500
				ctx.body = {
					message: "Internal Server Error",
				}
				return
			}

			return parsedSearchResults.data
		}

		ctx.status = 200
		ctx.body = {
			message: "Bus stops found",
			count: res.length,
			data: await getSearchResults(),
		}
		return
	},
})
