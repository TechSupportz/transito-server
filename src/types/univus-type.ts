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

const NUSETAValueSchema = z.object({
	eta: z.number(),
	eta_s: z.number(),
	ts: z.string(),
	plate: z.string(),
	jobid: z.number(),
	px: z.string(),
})

export const NUSShuttleSchema = z.object({
	name: z.string(),
	routeid: z.number(),
	busstopcode: z.string(),
	_etas: z.array(NUSETAValueSchema),
	arrivalTime: z.string(),
	nextArrivalTime: z.string(),
	passengers: z.string(),
	nextPassengers: z.string(),
	arrivalTime_veh_plate: z.string(),
	nextArrivalTime_veh_plate: z.string(),
})

export const NUSShuttleServiceResponseSchema = z.object({
	ShuttleServiceResult: z.object({
		TimeStamp: z.string(),
		caption: z.string(),
		name: z.string(),
		shuttles: z.array(NUSShuttleSchema),
		hints: z.array(z.unknown()),
	}),
})

export const NUSPickupPointSchema = z.object({
	routeid: z.number(),
	seq: z.number(),
	pickupname: z.string(),
	LongName: z.string(),
	ShortName: z.string(),
	busstopcode: z.string(),
	lat: z.number(),
	lng: z.number(),
})

export const NUSPickupPointResponseSchema = z.object({
	PickupPointResult: z.object({
		pickuppoint: z.array(NUSPickupPointSchema),
	}),
})

export const NUSRouteMinMaxTimeSchema = z.object({
	DisplayOrder: z.string(),
	Route: z.string(),
	FirstTime: z.string(),
	LastTime: z.string(),
	ScheduleType: z.string(),
	DayType: z.string(),
	DayName: z.string().optional(),
	Dates: z.string().optional(),
})

export const NUSRouteMinMaxTimeResponseSchema = z.object({
	RouteMinMaxTimeResult: z.object({
		RouteMinMaxTime: z.array(NUSRouteMinMaxTimeSchema),
	}),
})

export const NUSActiveBusSchema = z.object({
	vehplate: z.string(),
	lat: z.number(),
	lng: z.number(),
	speed: z.number(),
	direction: z.number(),
	loadInfo: z.object({
		occupancy: z.number(),
		crowdLevel: z.string(),
		capacity: z.number(),
		ridership: z.number(),
	}),
})

export const NUSActiveBusResponseSchema = z.object({
	ActiveBusResult: z.object({
		TimeStamp: z.string(),
		ActiveBusCount: z.string(),
		activebus: z.array(NUSActiveBusSchema),
	}),
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
