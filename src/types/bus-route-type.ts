import z from "zod"

const LTABusRouteSchema = z.object({
	ServiceNo: z.string(),
	Operator: z.string(),
	Direction: z.union([z.literal(1), z.literal(2)]),
	StopSequence: z.number().int(),
	BusStopCode: z.string(),
	Distance: z.number(),
	WD_FirstBus: z.string(),
	WD_LastBus: z.string(),
	SAT_FirstBus: z.string(),
	SAT_LastBus: z.string(),
	SUN_FirstBus: z.string(),
	SUN_LastBus: z.string(),
})

export const LTABusRouteResponseSchema = z.object({
	"odata.metadata": z.string(),
	value: z.array(LTABusRouteSchema),
})

const BusScheduleSchema = z.object({
	weekdays: z.string(),
	saturday: z.string(),
	sunday: z.string(),
})

export const BusRouteStopSchema = z.object({
	code: z.number(),
	name: z.string(),
	sequence: z.number(),
	distance: z.number(),
	firstBus: BusScheduleSchema,
	lastBus: BusScheduleSchema,
})

export type LTABusRoute = z.infer<typeof LTABusRouteSchema>
export type LTABusRouteResponse = z.infer<typeof LTABusRouteResponseSchema>
export type BusRouteStop = z.infer<typeof BusRouteStopSchema>
