import { z } from "zod"

export const UnivusAccessTokenResponseSchema = z.object({
	msg: z.string(),
	code: z.string(),
	data: z.object({
		username: z.string(),
		token: z.string(),
		userid: z.string(),
		domain: z.string(),
	}),
	ts: z.string(),
})

export const UnivusJwtPayloadSchema = z.object({
	exp: z.coerce.number().int().min(0),
})

export const UnivusMapDataItemSchema = z.object({
	category: z.array(z.string()),
	code: z.string(),
	name: z.string(),
	title: z.string(),
	longitude: z.coerce.number(),
	latitude: z.coerce.number(),
	id: z.string(),
})

export const UnivusMapsDataResponseSchema = z.object({
	msg: z.string(),
	code: z.literal("00000"),
	data: z.array(UnivusMapDataItemSchema),
	map_category_list: z.array(z.unknown()).optional(),
	ts: z.string(),
})

export const NUSBusProxyEnvelopeSchema = z.object({
	data: z.unknown(),
	code: z.string(),
	msg: z.string(),
	ts: z.string(),
})

const NUSETAValueSchema = z.object({
	eta: z.coerce.number(),
	eta_s: z.coerce.number().optional(),
	ts: z.string().optional(),
	plate: z.string().optional().default(""),
	jobid: z.coerce.number().optional(),
	px: z.string().optional(),
})

export const NUSShuttleSchema = z.object({
	name: z.string(),
	routeid: z.coerce.number().optional(),
	busstopcode: z.string(),
	_etas: z.array(NUSETAValueSchema),
	arrivalTime: z.string().optional(),
	nextArrivalTime: z.string().optional(),
	passengers: z.string().optional(),
	nextPassengers: z.string().optional(),
	arrivalTime_veh_plate: z.string().optional(),
	nextArrivalTime_veh_plate: z.string().optional(),
})

export const NUSShuttleServiceDataSchema = z.object({
	TimeStamp: z.string().optional(),
	caption: z.string().optional(),
	name: z.string().optional(),
	shuttles: z.array(NUSShuttleSchema),
	hints: z.array(z.unknown()).optional(),
})

export const NUSPickupPointSchema = z.object({
	routeid: z.coerce.number().optional(),
	seq: z.coerce.number(),
	pickupname: z.string().optional(),
	LongName: z.string(),
	ShortName: z.string().optional(),
	busstopcode: z.string(),
	lat: z.coerce.number(),
	lng: z.coerce.number(),
})

export const NUSPickupPointDataSchema = z.object({
	pickuppoint: z.array(NUSPickupPointSchema),
})

export const NUSRouteMinMaxTimeSchema = z.object({
	DisplayOrder: z.string(),
	Route: z.string(),
	FirstTime: z.string(),
	LastTime: z.string(),
	ScheduleType: z.string(),
	DayType: z.string(),
	DayName: z.string().nullish(),
	Dates: z.string().nullish(),
})

export const NUSRouteMinMaxTimeDataSchema = z.object({
	RouteMinMaxTime: z.array(NUSRouteMinMaxTimeSchema),
})

export const NUSActiveBusSchema = z.object({
	vehplate: z.string(),
	lat: z.coerce.number(),
	lng: z.coerce.number(),
	speed: z.coerce.number().optional(),
	direction: z.coerce.number().optional(),
	loadInfo: z.object({
		occupancy: z.coerce.number().optional(),
		crowdLevel: z.string().optional(),
		capacity: z.coerce.number().optional(),
		ridership: z.coerce.number().optional(),
	}).optional(),
})

export const NUSActiveBusDataSchema = z.object({
	TimeStamp: z.string().optional(),
	ActiveBusCount: z.string().optional(),
	activebus: z.array(NUSActiveBusSchema),
})

export const LTABusArrivalSchema = z.object({
	OriginCode: z.string(),
	DestinationCode: z.string(),
	EstimatedArrival: z.string(),
	Monitored: z.union([z.literal(0), z.literal(1)]),
	Latitude: z.string(),
	Longitude: z.string(),
	VisitNumber: z.string(),
	Load: z.enum(["SEA", "SDA", "LSD", ""]),
	Feature: z.enum(["WAB", ""]),
	Type: z.enum(["SD", "DD", "BD", ""]),
})

export const LTABusArrivalServiceSchema = z.object({
	ServiceNo: z.string(),
	Operator: z.enum(["SBST", "SMRT", "TTS", "GAS"]),
	NextBus: LTABusArrivalSchema,
	NextBus2: LTABusArrivalSchema,
	NextBus3: LTABusArrivalSchema,
})

export const NUSArrivalServiceSchema = z.object({
	ServiceNo: z.string(),
	Operator: z.literal("NUS"),
	NextBus: LTABusArrivalSchema,
	NextBus2: LTABusArrivalSchema,
	NextBus3: LTABusArrivalSchema,
})

export type TUnivusAccessTokenResponse = z.infer<typeof UnivusAccessTokenResponseSchema>
export type TUnivusJwtPayload = z.infer<typeof UnivusJwtPayloadSchema>
export type TUnivusMapsDataResponse = z.infer<typeof UnivusMapsDataResponseSchema>
export type TUnivusBusStop = z.infer<typeof UnivusMapDataItemSchema>
export type TLTABusArrival = z.infer<typeof LTABusArrivalSchema>
export type TLTABusArrivalService = z.infer<typeof LTABusArrivalServiceSchema>
export type TNUSArrivalEta = z.infer<typeof NUSETAValueSchema>
export type TNUSArrivalService = z.infer<typeof NUSArrivalServiceSchema>
export type TNUSShuttle = z.infer<typeof NUSShuttleSchema>
export type TNUSPickupPoint = z.infer<typeof NUSPickupPointSchema>
export type TNUSRouteMinMaxTime = z.infer<typeof NUSRouteMinMaxTimeSchema>
export type TNUSActiveBus = z.infer<typeof NUSActiveBusSchema>
