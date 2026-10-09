import { z } from "zod"

export const ROUTE_DISTANCE_INDEX_SCHEMA_VERSION = 1

const RouteDistanceIndexStopSchema = z.tuple([z.string(), z.number()])

export const RouteDistanceIndexSchema = z.object({
	schemaVersion: z.literal(ROUTE_DISTANCE_INDEX_SCHEMA_VERSION),
	stops: z.record(z.string(), z.tuple([z.number(), z.number()])),
	services: z.record(z.string(), z.array(z.array(RouteDistanceIndexStopSchema).min(1)).min(1)),
})

export type TRouteDistanceIndex = z.infer<typeof RouteDistanceIndexSchema>
export type TRouteDistanceIndexStop = z.infer<typeof RouteDistanceIndexStopSchema>
