import { z } from "zod"

export const LTABusStopSchema = z.object({
	BusStopCode: z.string(),
	RoadName: z.string(),
	Description: z.string(),
	Latitude: z.string(),
	Longitude: z.string(),
})

export const LTABusStopResponseSchema = z.object({
	"odata.metadata": z.string(),
	value: z.array(LTABusStopSchema),
})

export const SimpleBusStopSchema = z.object({
	code: z.number(),
	name: z.string(),
})

export type LTABusStop = z.infer<typeof LTABusStopSchema>
export type LTABusStopResponse = z.infer<typeof LTABusStopResponseSchema>
