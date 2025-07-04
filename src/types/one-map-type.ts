import { z } from "zod"

export const OneMapTokenResponseSchema = z.object({
	access_token: z.string(),
	expiry_timestamp: z.coerce.number().int().min(0),
})

export const OneMapAPISearchResponseSchema = z.object({
	found: z.number(),
	totalNumPages: z.number(),
	pageNum: z.number(),
	results: z.array(
		z.object({
			SEARCHVAL: z.string(),
			BLK_NO: z.string().nullish(),
			ROAD_NAME: z.string(),
			BUILDING: z.string(),
			ADDRESS: z.string(),
			POSTAL: z.string().nullish(),
			X: z.string(),
			Y: z.string(),
			LATITUDE: z.coerce.number().min(-90).max(90),
			LONGITUDE: z.coerce.number().min(-180).max(180),
		}),
	),
})

export const SearchOneMapDataSchema = z.object({
	name: z.string(),
	address: z.string(),
	postalCode: z.string().nullish(),
	latitude: z.coerce.number().min(-90).max(90),
	longitude: z.coerce.number().min(-180).max(180),
})

export const SearchOneMapResponseSchema = z.object({
	totalCount: z.number().int().min(0),
	count: z.number().int().min(0),
	totalPages: z.number().int().min(1),
	page: z.number().int().min(1),
	data: z.array(SearchOneMapDataSchema),
})

export type TOneMapTokenResponse = z.infer<typeof OneMapTokenResponseSchema>
export type TOneMapAPISearchResponse = z.infer<typeof OneMapAPISearchResponseSchema>
export type TSearchOneMapData = z.infer<typeof SearchOneMapDataSchema>
export type TSearchOneMap = z.infer<typeof SearchOneMapResponseSchema>
