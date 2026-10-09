import { createHash } from "crypto"
import { gzipSync } from "zlib"
import { TBusRouteStop } from "@app-types/bus-route-type"
import { TBusService } from "@app-types/bus-service-type"
import {
	ROUTE_DISTANCE_INDEX_SCHEMA_VERSION,
	TRouteDistanceIndex,
	TRouteDistanceIndexStop,
} from "@app-types/route-distance-index-type"
import { roundTo } from "@utils/geo"

export type TEncodedRouteDistanceIndex = {
	json: string
	gzip: Buffer
	contentHash: string
}

/**
 * Compact per-route cumulative distances the app uses to measure how far a bus is from a stop
 * along its route. Keys are sorted so the same routes always serialise to the same bytes.
 */
export function buildRouteDistanceIndex(busServices: TBusService[]): TRouteDistanceIndex {
	const stops = new Map<string, [number, number]>()
	const services = new Map<string, TRouteDistanceIndexStop[][]>()

	for (const service of busServices) {
		const routes = (service.routes ?? []).filter((route) => {
			if (hasKnownRouteDistances(route)) {
				return true
			}

			console.warn(
				`⚠️ Leaving route ${service.serviceNo} (${route[0]?.busStop.code ?? "-"} → ${route.at(-1)?.busStop.code ?? "-"}) out of the route distance index`,
			)
			return false
		})

		if (routes.length === 0) {
			continue
		}

		services.set(
			service.serviceNo,
			routes.map((route) =>
				route.map(({ busStop, distance }) => {
					stops.set(busStop.code, [
						roundTo(busStop.latitude, 6),
						roundTo(busStop.longitude, 6),
					])
					return [busStop.code, roundTo(distance, 3)]
				}),
			),
		)
	}

	return {
		schemaVersion: ROUTE_DISTANCE_INDEX_SCHEMA_VERSION,
		stops: sortedRecord(stops),
		services: sortedRecord(services),
	}
}

export function encodeRouteDistanceIndex(index: TRouteDistanceIndex): TEncodedRouteDistanceIndex {
	const json = JSON.stringify(index)

	return {
		json,
		// Node writes a zero mtime in the gzip header, so equal JSON gives equal bytes.
		gzip: gzipSync(json, { level: 9 }),
		contentHash: createHash("sha256").update(json, "utf8").digest("hex"),
	}
}

// A route is usable when its distances never decrease and actually cover some ground; NUS
// routes without checkpoint distances are all zero.
function hasKnownRouteDistances(route: TBusRouteStop[]) {
	if (route.length < 2) {
		return false
	}

	for (let i = 1; i < route.length; i++) {
		if (route[i].distance < route[i - 1].distance) {
			return false
		}
	}

	return route[route.length - 1].distance > route[0].distance
}

function sortedRecord<T>(entries: Map<string, T>): Record<string, T> {
	return Object.fromEntries([...entries].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}
