const EARTH_MEAN_RADIUS_KM = 6371.0088

export function getHaversineDistanceKm(
	from: { latitude: number; longitude: number },
	to: { latitude: number; longitude: number },
) {
	const toRadians = (degrees: number) => (degrees * Math.PI) / 180
	const dLat = toRadians(to.latitude - from.latitude)
	const dLng = toRadians(to.longitude - from.longitude)
	const h =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2

	return 2 * EARTH_MEAN_RADIUS_KM * Math.asin(Math.sqrt(h))
}

export function roundTo(value: number, decimals: number) {
	const factor = 10 ** decimals
	return Math.round(value * factor) / factor
}

const METERS_PER_DEGREE_LATITUDE = 110_574
const METERS_PER_DEGREE_LONGITUDE_AT_EQUATOR = 111_320

/**
 * Shortest distance (m) from a point to the segment between two points. Projects onto a flat
 * plane around the point, which is accurate to well under a metre at Singapore's scale.
 */
export function getPointToSegmentDistanceM(
	point: { latitude: number; longitude: number },
	start: { latitude: number; longitude: number },
	end: { latitude: number; longitude: number },
) {
	const metersPerDegreeLongitude =
		METERS_PER_DEGREE_LONGITUDE_AT_EQUATOR * Math.cos((point.latitude * Math.PI) / 180)
	const toPlane = ({ latitude, longitude }: { latitude: number; longitude: number }) => ({
		x: (longitude - point.longitude) * metersPerDegreeLongitude,
		y: (latitude - point.latitude) * METERS_PER_DEGREE_LATITUDE,
	})

	const a = toPlane(start)
	const b = toPlane(end)
	const dx = b.x - a.x
	const dy = b.y - a.y
	const lengthSquared = dx * dx + dy * dy
	const t =
		lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSquared))

	return Math.hypot(a.x + t * dx, a.y + t * dy)
}
