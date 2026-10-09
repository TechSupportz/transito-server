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
