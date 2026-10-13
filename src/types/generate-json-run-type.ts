import z from "zod"
import { RoutePolylineSummarySchema } from "@app-types/route-shape-type"

export const GenerateJSONSummarySchema = z.object({
	durationSeconds: z.number(),
	busStops: z.number().int(),
	busServices: z.number().int(),
	routeDistanceIndex: z.enum(["uploaded", "unchanged", "skipped", "failed"]),
	routePolylines: RoutePolylineSummarySchema,
})

export const GenerateJSONRunSchema = z.object({
	startedAt: z.string(),
	finishedAt: z.string().optional(),
	status: z.enum(["running", "succeeded", "failed"]),
	summary: GenerateJSONSummarySchema.optional(),
	error: z.string().optional(),
})

export type TGenerateJSONSummary = z.infer<typeof GenerateJSONSummarySchema>
export type TGenerateJSONRun = z.infer<typeof GenerateJSONRunSchema>
