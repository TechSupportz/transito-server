import { getOneMapHeaders, oneMapBaseUrl } from "@utils/one-map-api"
import { defineRoute } from "@utils/route-builder"
import { zodFetch } from "@utils/zod-fetch"
import z from "zod"
import {
	OneMapAPISearchResponseSchema,
	TSearchOneMap,
	TSearchOneMapData,
} from "../../types/one-map-type"

export const searchOneMap = defineRoute({
	method: "get",
	path: "/onemap/search",
	validate: {
		query: z.object({
			query: z.string().min(1, { message: "Query must be at least 1 character long" }),
			page: z.coerce.number().int().default(1),
		}),
	},
	handler: async (ctx) => {
		const { query, page } = ctx.request.query
		const oneMapHeaders = await getOneMapHeaders()

		const oneMapSearchQueryParams = new URLSearchParams({
			searchVal: query,
			returnGeom: "Y",
			getAddrDetails: "Y",
			pageNum: page ? page.toString() : "1",
		}).toString()

		try {
			const res = await zodFetch(
				`${oneMapBaseUrl}/api/common/elastic/search?${oneMapSearchQueryParams}`,
				{
					method: "GET",
					headers: oneMapHeaders,
				},
				OneMapAPISearchResponseSchema,
			)

			const formattedResults: TSearchOneMapData[] = res.results.map((result) => ({
				name: result.SEARCHVAL,
				address: result.ADDRESS,
				postalCode: result.POSTAL === "NIL" ? null : result.POSTAL,
				latitude: result.LATITUDE,
				longitude: result.LONGITUDE,
			}))

			const response: TSearchOneMap = {
				totalCount: res.found,
				count: formattedResults.length,
				totalPages: res.totalNumPages,
				page: res.pageNum,
				data: formattedResults,
			}

			ctx.status = 200
			ctx.body = response
			return
		} catch (error) {
			ctx.status = 500
			ctx.body = {
				message: "Error fetching data from OneMap",
				error: error instanceof Error ? error.message : "Unknown error",
			}
			return
		}
	},
})
