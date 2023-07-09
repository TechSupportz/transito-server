import z from "zod"
import { SimpleBusStopSchema } from "./bus-stop-type"
import { BusRouteStopSchema } from "./bus-route-type"

export const LTABusServiceSchema = z.object({
	ServiceNo: z.string(),
	Operator: z.string(),
	Direction: z.number(),
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
	interchanges: z.array(SimpleBusStopSchema).length(2),
	routes: z.array(BusRouteStopSchema).length(2),
})

export type LTABusService = z.infer<typeof LTABusServiceSchema>
export type LTABusServiceResponse = z.infer<typeof LTABusServiceResponseSchema>
export type BusService = z.infer<typeof BusServiceSchema>
