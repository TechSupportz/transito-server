import z from "zod"
import { BusRouteStopSchema } from "./bus-route-type"
import { BusStopSearchSchema } from "./bus-stop-type"

export const LTABusServiceSchema = z.object({
	ServiceNo: z.string(),
	Operator: z.string(),
	Direction: z.union([z.literal(1), z.literal(2)]),
	Category: z.string(),
	OriginCode: z.string(),
	DestinationCode: z.string(),
	AM_Peak_Freq: z.string(),
	AM_Offpeak_Freq: z.string(),
	PM_Peak_Freq: z.string(),
	PM_Offpeak_Freq: z.string(),
	LoopDesc: z.string(),
})

export const LTABusServiceResponseSchema = z.object({
	"odata.metadata": z.string(),
	value: z.array(LTABusServiceSchema),
})

export const BusServiceSchema = z.object({
	serviceNo: z.string(),
	operator: z.string(),
	isLoopService: z.boolean(),
	interchanges: z.array(BusStopSearchSchema).length(2),
	routes: z.array(z.array(BusRouteStopSchema)).max(2).optional(),
})

export const BusServiceJSONSchema = z.object({
	metadata: z.string().datetime({ offset: true }),
	data: z.array(BusServiceSchema),
})

export type LTABusService = z.infer<typeof LTABusServiceSchema>
export type LTABusServiceResponse = z.infer<typeof LTABusServiceResponseSchema>
export type BusService = z.infer<typeof BusServiceSchema>
export type BusServiceJSON = z.infer<typeof BusServiceJSONSchema>
