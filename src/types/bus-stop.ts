import { z } from "zod"

export const BusStopSchema = z.object({
	BusStopCode: z.string(),
	RoadName: z.string(),
	Description: z.string(),
	Latitude: z.string(),
	Longitude: z.string(),
})

export const BusStopResponseSchema = z.object({
	"odata.metadata": z.string(),
	value: z.array(BusStopSchema),
})

export type BusStop = z.infer<typeof BusStopSchema>
export type BusStopResponse = z.infer<typeof BusStopResponseSchema>