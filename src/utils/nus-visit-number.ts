import { TBusRouteStop } from "@app-types/bus-route-type"

type TLocation = { latitude: number; longitude: number }

const EARTH_MEAN_RADIUS_M = 6_371_008.8

// Two stretches fit "about equally well" when the bus is within this many metres of both: a bus
// at the repeated stop has just finished one stretch and is starting the next, and stretches
// overlap on roads the route goes back along.
export const AMBIGUOUS_MARGIN_M = 30

// Stretches are straight stop-to-stop chords, not the road path, so allow for curves. A bus
// further than this from every stretch is off the Service Route and gets no guess.
export const OFF_ROUTE_LIMIT_M = 500

/**
 * Works out which visit to a stop on an NUS Service Route a live arrival is for, as the LTA
 * `VisitNumber` string: "1" when the stop is visited once, the 1-based visit when the bus's live
 * location settles it, and "" (unknown) otherwise.
 */
export function getNUSVisitNumber(
	route: TBusRouteStop[] | undefined,
	nusStopCode: string,
	busLocation: TLocation | undefined,
): string {
	if (!route?.length) {
		return ""
	}

	const visitIndices = getVisitIndices(route, nusStopCode)
	if (visitIndices.length === 0) {
		return ""
	}
	if (visitIndices.length === 1) {
		return "1"
	}
	if (!busLocation || !isFiniteLocation(busLocation)) {
		return ""
	}

	const stretchDistances = visitIndices.map((visitIndex, visit) => {
		const startIndex = visit === 0 ? 0 : visitIndices[visit - 1]
		const stretch = route
			.slice(startIndex, visitIndex + 1)
			.map((routeStop) => routeStop.busStop)
		return getDistanceToPolylineM(busLocation, stretch)
	})

	const ranked = stretchDistances
		.map((distance, visit) => ({ distance, visit }))
		.sort((a, b) => a.distance - b.distance)
	const [best, runnerUp] = ranked

	if (!Number.isFinite(best.distance) || best.distance > OFF_ROUTE_LIMIT_M) {
		return ""
	}
	if (runnerUp.distance - best.distance < AMBIGUOUS_MARGIN_M) {
		return ""
	}

	return String(best.visit + 1)
}

function getVisitIndices(route: TBusRouteStop[], nusStopCode: string) {
	const visitIndices = route.flatMap((routeStop, index) =>
		routeStop.busStop.sources.NUS === nusStopCode ? [index] : [],
	)

	// A loop's terminal is listed at both ends. Arrivals for the ending terminal are dropped
	// upstream, so an arrival there is a departure, which LTA counts as visit 1.
	const lastIndex = route.length - 1
	if (visitIndices.length > 1 && visitIndices[0] === 0 && visitIndices.at(-1) === lastIndex) {
		visitIndices.pop()
	}

	return visitIndices
}

function isFiniteLocation(location: TLocation) {
	return Number.isFinite(location.latitude) && Number.isFinite(location.longitude)
}

function getDistanceToPolylineM(point: TLocation, polyline: TLocation[]) {
	const projected = polyline.map((vertex) => projectM(point, vertex))

	if (projected.length === 1) {
		return Math.hypot(projected[0].x, projected[0].y)
	}

	let minDistance = Infinity
	for (let i = 1; i < projected.length; i++) {
		minDistance = Math.min(minDistance, getDistanceToSegmentM(projected[i - 1], projected[i]))
	}
	return minDistance
}

// Equirectangular projection in metres, centred on the bus; accurate at campus scale.
function projectM(origin: TLocation, location: TLocation) {
	const toRadians = (degrees: number) => (degrees * Math.PI) / 180
	return {
		x:
			toRadians(location.longitude - origin.longitude) *
			Math.cos(toRadians(origin.latitude)) *
			EARTH_MEAN_RADIUS_M,
		y: toRadians(location.latitude - origin.latitude) * EARTH_MEAN_RADIUS_M,
	}
}

// Distance from the origin (the bus) to segment a-b.
function getDistanceToSegmentM(a: { x: number; y: number }, b: { x: number; y: number }) {
	const dx = b.x - a.x
	const dy = b.y - a.y
	const lengthSquared = dx * dx + dy * dy
	const t =
		lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared))
	return Math.hypot(a.x + t * dx, a.y + t * dy)
}
