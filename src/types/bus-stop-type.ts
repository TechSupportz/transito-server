import { z } from "zod"

export const LTABusStopSchema = z.object({
	BusStopCode: z.string(),
	RoadName: z.string(),
	Description: z.string(),
	Latitude: z.number().min(-90).max(90),
	Longitude: z.number().min(-180).max(180),
})

export const LTABusStopResponseSchema = z.object({
	"odata.metadata": z.string(),
	value: z.array(LTABusStopSchema),
})

export const SimpleBusStopSchema = z.object({
	code: z.string().length(5),
	name: z.string(),
})

export const BusStopSchema = z.object({
	code: z.string().length(5),
	name: z.string(),
	roadName: z.string(),
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	services: z.array(z.string()),
})

export const BusStopJSONSchema = z.object({
	metadata: z.string().datetime(),
	data: z.array(BusStopSchema),
})

export const NearbyBusStopSchema = z.object({
	busStop: BusStopSchema,
	distanceAway: z.number(),
})

export type LTABusStop = z.infer<typeof LTABusStopSchema>
export type LTABusStopResponse = z.infer<typeof LTABusStopResponseSchema>
export type SimpleBusStop = z.infer<typeof SimpleBusStopSchema>
export type BusStop = z.infer<typeof BusStopSchema>
export type BusStopJSON = z.infer<typeof BusStopJSONSchema>
export type NearbyBusStop = z.infer<typeof NearbyBusStopSchema>
