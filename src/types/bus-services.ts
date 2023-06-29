import z from "zod"

export const BusServiceSchema = z.object({
	ServiceNo: z.string(),
	Operator: z.string(),
	Direction: z.number(),
	Category: z.string(),
	OriginCode: z.number(),
	DestinationCode: z.number(),
	AM_Peak_Freq: z.string(),
	AM_Offpeak_Freq: z.string(),
	PM_Peak_Freq: z.string(),
	PM_Offpeak_Freq: z.string(),
	LoopDesc: z.string(),
})

export const BusServiceResponseSchema = z.object({
	"odata.metadata": z.string(),
	value: z.array(BusServiceSchema),
})

export type BusService = z.infer<typeof BusServiceSchema>
export type BusServiceResponse = z.infer<typeof BusServiceResponseSchema>
