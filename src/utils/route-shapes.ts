import polyline from "@mapbox/polyline"
import simplify from "simplify-js"
import { TBusRouteStop } from "@app-types/bus-route-type"
import { TBusService } from "@app-types/bus-service-type"
import { TOneMapBusRoutesResponse } from "@app-types/one-map-type"
import { TLatLng, TRoutePolylineIssue, TRoutePolylineSummary } from "@app-types/route-shape-type"
import { TNUSCheckpoint } from "@app-types/univus-type"
import {
	fetchLTARouteKML,
	fetchLTARouteKMLFileNames,
	LTABlockedError,
} from "@fetchers/lta-route-kml-fetcher"
import { fetchOneMapBusRoutes } from "@fetchers/one-map-bus-route-fetcher"
import { getBusServiceFromServiceNo } from "@utils/bus-services"
import { getHaversineDistanceKm, getPointToSegmentDistanceM, roundTo } from "@utils/geo"

// Thresholds from the October 2026 survey of every LTA KML (docs/adr/0003).
// A stop this far from its line means the KML draws a different route.
export const MAX_STOP_DISTANCE_M = 500
// Terminal and depot stops set back from the road sit up to about 470 m away.
export const SUSPECT_STOP_DISTANCE_M = 300
// A gap this wide after joining LineStrings means a piece is missing.
export const MAX_JOIN_GAP_M = 300
// About 5 m; encoding at precision 5 already rounds to about 1 m.
export const SIMPLIFY_TOLERANCE_DEGREES = 0.000045

// LTA's firewall blocks an IP after a burst of about a hundred requests, so fetch one at a time.
export const KML_REQUEST_GAP_MS = 500
export const ONE_MAP_REQUEST_GAP_MS = 200

export type TRoutePolylines = Map<string, (string | null)[]>

export type TRoutePolylineResult = {
	polylines: TRoutePolylines
	summary: TRoutePolylineSummary
}

type TDirection = {
	id: string
	service: TBusService
	index: number
	stops: TBusRouteStop[]
}

type TCandidate =
	| { ok: true; line: TLatLng[]; suspect?: string }
	| { ok: false; reason: string; gappyLine?: TLatLng[]; suspect?: string }

type TOutcome =
	| { source: "kml" | "onemap" | "nus" | "reused"; polyline: string }
	| { source: "missing"; polyline: null }

/**
 * Builds a Route Shape for every Service Route as an encoded polyline. LTA directions use LTA's KML,
 * then OneMap's stop-to-stop segments, then the previous catalogue's polyline when the stops have
 * not changed. NUS directions use the checkpoint path. Never throws for a single direction; a
 * direction with no usable shape gets null.
 */
export async function buildRoutePolylines(
	busServices: TBusService[],
	nusCheckpoints: Map<string, TNUSCheckpoint[] | null>,
): Promise<TRoutePolylineResult> {
	const startedAt = Date.now()
	const summary = createEmptySummary()
	const directions = busServices.flatMap((service) =>
		(service.routes ?? []).map((stops, index): TDirection => ({
			id: `${service.serviceNo}-${index + 1}`,
			service,
			index,
			stops,
		})),
	)
	const outcomes = new Map<string, TOutcome>()

	const ltaDirections = directions.filter((direction) => direction.service.operator !== "NUS")
	const nusDirections = directions.filter((direction) => direction.service.operator === "NUS")

	const kmlCandidates = await getKMLCandidates(ltaDirections, summary)
	const needsFallback: { direction: TDirection; candidate: TCandidate & { ok: false } }[] = []

	for (const direction of ltaDirections) {
		const candidate = kmlCandidates.get(direction.id)!

		if (candidate.ok) {
			outcomes.set(direction.id, { source: "kml", polyline: encodeLine(candidate.line) })
			addSuspect(summary, direction, candidate.suspect)
		} else {
			needsFallback.push({ direction, candidate })
		}
	}

	const oneMapResults = await getOneMapLines(needsFallback.map(({ direction }) => direction))

	for (const { direction, candidate } of needsFallback) {
		const oneMap = oneMapResults.get(direction.id)!

		if (oneMap.ok) {
			outcomes.set(direction.id, { source: "onemap", polyline: encodeLine(oneMap.line) })
			summary.onemap.push({ direction: direction.id, reason: `KML ${candidate.reason}` })
			continue
		}

		// A gappy KML still follows the right roads, so it beats reusing an older shape.
		if (candidate.gappyLine) {
			outcomes.set(direction.id, { source: "kml", polyline: encodeLine(candidate.gappyLine) })
			addSuspect(summary, direction, `KML ${candidate.reason}; OneMap ${oneMap.reason}`)
			continue
		}

		outcomes.set(
			direction.id,
			getFallbackOutcome(
				direction,
				summary,
				`KML ${candidate.reason}; OneMap ${oneMap.reason}`,
			),
		)
	}

	for (const direction of nusDirections) {
		const candidate = getNUSCandidate(
			direction,
			nusCheckpoints.get(direction.service.serviceNo),
		)

		if (candidate.ok) {
			outcomes.set(direction.id, { source: "nus", polyline: encodeLine(candidate.line) })
			addSuspect(summary, direction, candidate.suspect)
		} else {
			outcomes.set(
				direction.id,
				getFallbackOutcome(direction, summary, `checkpoints ${candidate.reason}`),
			)
		}
	}

	const polylines: TRoutePolylines = new Map()

	for (const direction of directions) {
		const outcome = outcomes.get(direction.id)!
		summary.counts[outcome.source]++

		const servicePolylines = polylines.get(direction.service.serviceNo) ?? []
		servicePolylines[direction.index] = outcome.polyline
		polylines.set(direction.service.serviceNo, servicePolylines)
	}

	summary.directions = directions.length
	summary.counts.suspect = summary.suspect.length
	summary.counts.notPublished = summary.notPublished.length
	summary.counts.fetchFailed = summary.fetchFailed.length
	summary.counts.rejected = summary.rejected.length
	summary.durationSeconds = roundTo((Date.now() - startedAt) / 1000, 1)

	console.log(
		`🛣️ Route polylines: ${JSON.stringify(summary.counts)} in ${summary.durationSeconds}s`,
	)

	return { polylines, summary }
}

export function createEmptySummary(): TRoutePolylineSummary {
	return {
		durationSeconds: 0,
		directions: 0,
		counts: {
			kml: 0,
			onemap: 0,
			nus: 0,
			reused: 0,
			missing: 0,
			suspect: 0,
			notPublished: 0,
			fetchFailed: 0,
			rejected: 0,
		},
		onemap: [],
		reused: [],
		missing: [],
		suspect: [],
		notPublished: [],
		fetchFailed: [],
		rejected: [],
	}
}

async function getKMLCandidates(
	directions: TDirection[],
	summary: TRoutePolylineSummary,
): Promise<Map<string, TCandidate>> {
	let fileNames: Set<string> | null = null
	let isBlocked = false

	try {
		fileNames = await fetchLTARouteKMLFileNames()
	} catch (error) {
		isBlocked = error instanceof LTABlockedError
		// Without the list, request every file and let 404s mark the unpublished ones.
		console.warn(`⚠️ Could not fetch LTA's bus service list: ${error}`)
	}

	const candidates = new Map<string, TCandidate>()
	let hasRequested = false

	for (const direction of directions) {
		candidates.set(direction.id, await getKMLCandidate(direction))
	}

	if (isBlocked) {
		console.warn("⚠️ LTA blocked KML requests with HTTP 403, skipped the remaining files")
	}

	return candidates

	async function getKMLCandidate(direction: TDirection): Promise<TCandidate> {
		const fileName = `${direction.id}.kml`

		if (fileNames && !fileNames.has(fileName)) {
			addIssue(summary.notPublished, direction, "not listed by LTA")
			return { ok: false, reason: "not listed by LTA" }
		}

		if (isBlocked) {
			addIssue(summary.fetchFailed, direction, "skipped, LTA is blocking requests (HTTP 403)")
			return { ok: false, reason: "skipped (LTA blocking requests)" }
		}

		if (hasRequested) {
			await new Promise((resolve) => setTimeout(resolve, KML_REQUEST_GAP_MS))
		}

		hasRequested = true
		const kml = await fetchLTARouteKML(fileName)

		if (kml.status === "blocked") {
			isBlocked = true
			addIssue(summary.fetchFailed, direction, "HTTP 403")
			return { ok: false, reason: "fetch failed (HTTP 403)" }
		}

		if (kml.status === "notFound") {
			addIssue(summary.notPublished, direction, "HTTP 404")
			return { ok: false, reason: "not published (HTTP 404)" }
		}

		if (kml.status === "failed") {
			addIssue(summary.fetchFailed, direction, kml.reason)
			return { ok: false, reason: `fetch failed (${kml.reason})` }
		}

		const { line, maxGapM } = joinLines(kml.lines, getStopPoint(direction.stops[0]))
		const candidate = checkLine(line, direction.stops)

		if (!candidate.ok) {
			addIssue(summary.rejected, direction, candidate.reason)
			return { ok: false, reason: `rejected (${candidate.reason})` }
		}

		if (maxGapM > MAX_JOIN_GAP_M) {
			return {
				ok: false,
				reason: `has a ${Math.round(maxGapM)} m gap after joining`,
				gappyLine: line,
			}
		}

		return candidate
	}
}

async function getOneMapLines(
	directions: TDirection[],
): Promise<Map<string, { ok: true; line: TLatLng[] } | { ok: false; reason: string }>> {
	const results = new Map<string, { ok: true; line: TLatLng[] } | { ok: false; reason: string }>()
	const serviceNos = [...new Set(directions.map((direction) => direction.service.serviceNo))]
	const routesByService = new Map<string, TOneMapBusRoutesResponse | string>()

	// One gentle request at a time: this is OneMap's private endpoint, not a public API.
	for (const [index, serviceNo] of serviceNos.entries()) {
		if (index > 0) {
			await new Promise((resolve) => setTimeout(resolve, ONE_MAP_REQUEST_GAP_MS))
		}

		try {
			routesByService.set(serviceNo, await fetchOneMapBusRoutes(serviceNo))
		} catch (error) {
			routesByService.set(serviceNo, `fetch failed (${error})`)
		}
	}

	for (const direction of directions) {
		const routes = routesByService.get(direction.service.serviceNo)!

		if (typeof routes === "string") {
			results.set(direction.id, { ok: false, reason: routes })
			continue
		}

		const segments =
			(direction.index === 0 ? routes.BUS_DIRECTION_ONE : routes.BUS_DIRECTION_TWO) ?? []
		const oneMapStopCodes = segments.length
			? [
					segments[0].START_BUS_STOP_NUM,
					...segments.map((segment) => segment.END_BUS_STOP_NUM),
				]
			: []
		const stopCodes = direction.stops.map((stop) => stop.busStop.code)

		// Only an exact stop match proves OneMap's route is current; a mismatch is a stale route.
		if (oneMapStopCodes.join() !== stopCodes.join()) {
			results.set(direction.id, {
				ok: false,
				reason: segments.length
					? `stops differ (${oneMapStopCodes.length} vs ${stopCodes.length})`
					: "has no route for this direction",
			})
			continue
		}

		results.set(direction.id, {
			ok: true,
			line: segments.flatMap((segment) => polyline.decode(segment.GEOMETRIES) as TLatLng[]),
		})
	}

	return results
}

function getNUSCandidate(
	direction: TDirection,
	checkpoints: TNUSCheckpoint[] | null | undefined,
): TCandidate {
	if (!checkpoints?.length) {
		return { ok: false, reason: "unavailable" }
	}

	return checkLine(
		checkpoints.map(({ latitude, longitude }): TLatLng => [latitude, longitude]),
		direction.stops,
	)
}

/**
 * Joins LineStrings into one line. Starts from the endpoint nearest the first stop, then keeps
 * attaching the piece whose nearer endpoint is closest, reversing pieces as needed. Anchoring on
 * the first stop also turns a line drawn backwards the right way round.
 */
export function joinLines(lines: TLatLng[][], firstStop: TLatLng) {
	const remaining = lines.filter((line) => line.length > 0).map((line) => [...line])
	const line: TLatLng[] = []
	let maxGapM = 0

	if (remaining.length === 0) {
		return { line, maxGapM }
	}

	let anchor = firstStop

	while (remaining.length > 0) {
		let best = { index: 0, reverse: false, distanceM: Infinity }

		for (const [index, candidate] of remaining.entries()) {
			const toStartM = getDistanceM(anchor, candidate[0])
			const toEndM = getDistanceM(anchor, candidate[candidate.length - 1])

			if (toStartM < best.distanceM) {
				best = { index, reverse: false, distanceM: toStartM }
			}
			if (toEndM < best.distanceM) {
				best = { index, reverse: true, distanceM: toEndM }
			}
		}

		const [next] = remaining.splice(best.index, 1)

		if (line.length > 0) {
			maxGapM = Math.max(maxGapM, best.distanceM)
		}

		line.push(...(best.reverse ? next.reverse() : next))
		anchor = line[line.length - 1]
	}

	return { line, maxGapM }
}

function checkLine(line: TLatLng[], stops: TBusRouteStop[]): TCandidate {
	if (line.length < 2) {
		return { ok: false, reason: "has fewer than 2 points" }
	}

	const lineCoordinates = line.map(toCoordinate)
	let farthest = { code: "", distanceM: 0 }

	for (const stop of stops) {
		const distanceM = getDistanceToLineM(toCoordinate(getStopPoint(stop)), lineCoordinates)

		if (distanceM > farthest.distanceM) {
			farthest = { code: stop.busStop.code, distanceM }
		}
	}

	const description = `stop ${farthest.code} is ${Math.round(farthest.distanceM)} m from the line`

	if (farthest.distanceM > MAX_STOP_DISTANCE_M) {
		return { ok: false, reason: description }
	}

	return {
		ok: true,
		line,
		suspect: farthest.distanceM > SUSPECT_STOP_DISTANCE_M ? description : undefined,
	}
}

function getFallbackOutcome(
	direction: TDirection,
	summary: TRoutePolylineSummary,
	reason: string,
): TOutcome {
	const previousPolyline = getPreviousPolyline(direction)

	if (previousPolyline) {
		addIssue(summary.reused, direction, reason)
		return { source: "reused", polyline: previousPolyline }
	}

	addIssue(summary.missing, direction, reason)
	return { source: "missing", polyline: null }
}

/** The previous catalogue's polyline, only while the direction still serves the same stops. */
function getPreviousPolyline(direction: TDirection) {
	const previous = getBusServiceFromServiceNo(direction.service.serviceNo)
	const previousStops = previous?.routes?.[direction.index]
	const previousPolyline = previous?.routePolylines?.[direction.index]

	if (!previousStops || !previousPolyline) {
		return null
	}

	const stopCodes = direction.stops.map((stop) => stop.busStop.code).join()
	const previousStopCodes = previousStops.map((stop) => stop.busStop.code).join()

	return stopCodes === previousStopCodes ? previousPolyline : null
}

function encodeLine(line: TLatLng[]) {
	const simplified = simplify(
		line.map(([lat, lng]) => ({ x: lng, y: lat })),
		SIMPLIFY_TOLERANCE_DEGREES,
		true,
	)

	return polyline.encode(simplified.map(({ x, y }) => [y, x]))
}

type TCoordinate = { latitude: number; longitude: number }

function getDistanceToLineM(point: TCoordinate, line: TCoordinate[]) {
	let minDistanceM = Infinity

	for (let index = 1; index < line.length; index++) {
		minDistanceM = Math.min(
			minDistanceM,
			getPointToSegmentDistanceM(point, line[index - 1], line[index]),
		)
	}

	return minDistanceM
}

function getDistanceM(from: TLatLng, to: TLatLng) {
	return getHaversineDistanceKm(toCoordinate(from), toCoordinate(to)) * 1000
}

function getStopPoint(stop: TBusRouteStop): TLatLng {
	return [stop.busStop.latitude, stop.busStop.longitude]
}

function toCoordinate([latitude, longitude]: TLatLng): TCoordinate {
	return { latitude, longitude }
}

function addSuspect(summary: TRoutePolylineSummary, direction: TDirection, reason?: string) {
	if (reason) {
		addIssue(summary.suspect, direction, reason)
	}
}

function addIssue(issues: TRoutePolylineIssue[], direction: TDirection, reason: string) {
	issues.push({ direction: direction.id, reason })
}
