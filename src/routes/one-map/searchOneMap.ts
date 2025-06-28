import { createRouteSpec } from "koa-zod-router"
import z from "zod"
import { getOneMapHeaders, oneMapBaseUrl } from "../../utils/one-map-api"

export const searchOneMap = createRouteSpec({
	method: "get",
	path: "/onemap/search",
	validate: {
		query: z.object({
			query: z.string().min(1, { message: "Query must be at least 1 character long" }),
			page: z.coerce.number().int().min(1).default(1).optional(),
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
			const res = await fetch(
				`${oneMapBaseUrl}/api/common/elastic/search?${oneMapSearchQueryParams}`,
				{
					method: "GET",
					headers: oneMapHeaders,
				},
			)

			if (!res.ok) {
				throw new Error(`OneMap API error: ${res.status} ${res.statusText}`)
			}

			const data = await res.json()

			ctx.status = 200
			ctx.body = data // TODO - reparse data format and add typings
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
