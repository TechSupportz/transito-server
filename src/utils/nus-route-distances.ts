import { TNUSCheckpoint } from "@app-types/univus-type"
import { getHaversineDistanceKm, roundTo } from "@utils/geo"

// Rough Singapore bounding box. Anything outside it, including (0, 0), is a bad checkpoint.
const SINGAPORE_BOUNDS = {
	minLatitude: 1.1,
	maxLatitude: 1.5,
	minLongitude: 103.5,
	maxLongitude: 104.2,
}

/**
 * Cumulative distance (km) of each stop along an NUS service route, measured along the
 * checkpoint path from the first stop. The n-th `isbusstop` checkpoint is the n-th route stop.
 *
 * Returns null when there are no checkpoints, when any checkpoint has a missing or out-of-range
 * position, or when the number of stop checkpoints does not match the route, so callers keep the
 * distances unknown.
 */
export function getNUSRouteStopDistances(
	serviceNo: string,
	checkpoints: TNUSCheckpoint[] | null,
	stopCount: number,
): number[] | null {
	if (!checkpoints) {
		return null
	}

	if (!checkpoints.every(isInSingapore)) {
		console.warn(
			`⚠️ NUS service ${serviceNo} has checkpoints with missing or out-of-range positions, leaving its route distances unknown`,
		)
		return null
	}

	const stopDistances: number[] = []
	let pathDistance = 0

	for (const [index, checkpoint] of checkpoints.entries()) {
		if (index > 0) {
			pathDistance += getHaversineDistanceKm(checkpoints[index - 1], checkpoint)
		}

		if (checkpoint.isbusstop) {
			stopDistances.push(pathDistance)
		}
	}

	if (stopDistances.length !== stopCount) {
		console.warn(
			`⚠️ NUS service ${serviceNo} has ${stopDistances.length} checkpoint stops but ${stopCount} route stops, leaving its route distances unknown`,
		)
		return null
	}

	const origin = stopDistances[0] ?? 0
	const distances = stopDistances.map((distance) => roundTo(distance - origin, 3))

	if (!distances.every(Number.isFinite)) {
		console.warn(
			`⚠️ NUS service ${serviceNo} has non-finite checkpoint distances, leaving its route distances unknown`,
		)
		return null
	}

	return distances
}

function isInSingapore({ latitude, longitude }: TNUSCheckpoint) {
	return (
		latitude >= SINGAPORE_BOUNDS.minLatitude &&
		latitude <= SINGAPORE_BOUNDS.maxLatitude &&
		longitude >= SINGAPORE_BOUNDS.minLongitude &&
		longitude <= SINGAPORE_BOUNDS.maxLongitude
	)
}
