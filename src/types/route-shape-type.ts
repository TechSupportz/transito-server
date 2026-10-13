import z from "zod"

export const RoutePolylineIssueSchema = z.object({
	direction: z.string(),
	reason: z.string(),
})

export const RoutePolylineSummarySchema = z.object({
	durationSeconds: z.number(),
	directions: z.number().int(),
	counts: z.object({
		kml: z.number().int(),
		onemap: z.number().int(),
		nus: z.number().int(),
		reused: z.number().int(),
		missing: z.number().int(),
		suspect: z.number().int(),
		notPublished: z.number().int(),
		fetchFailed: z.number().int(),
		rejected: z.number().int(),
	}),
	// Directions whose shape came from the OneMap fallback, with why the KML was not used.
	onemap: z.array(RoutePolylineIssueSchema),
	reused: z.array(RoutePolylineIssueSchema),
	missing: z.array(RoutePolylineIssueSchema),
	suspect: z.array(RoutePolylineIssueSchema),
	notPublished: z.array(RoutePolylineIssueSchema),
	fetchFailed: z.array(RoutePolylineIssueSchema),
	rejected: z.array(RoutePolylineIssueSchema),
	error: z.string().optional(),
})

/** A [latitude, longitude] pair, the order encoded polylines use. */
export type TLatLng = [number, number]
export type TRoutePolylineIssue = z.infer<typeof RoutePolylineIssueSchema>
export type TRoutePolylineSummary = z.infer<typeof RoutePolylineSummarySchema>
