export const nusBusProxyBaseUrl = "https://inetapps.nus.edu.sg/univus/api/bus-proxy"

export const NUS_BUS_PROXY_ROUTES = {
	busStops: "bus-stops",
	busStopsAllPickups: "bus-stops-all-pickups",
	checkpointBusStop: "checkpoint-bus-stop",
	pickupPoint: "pickup-point",
	pickupPointShuttleService: "pickup-point-shuttle-service",
	routeMinMaxTime: "route-min-max-time",
	shuttleService: "shuttle-service",
	tickerTapes: "ticker-tapes",
	activeBus: "active-bus",
	busLocation: "bus-location",
} as const

export type TNUSBusProxyRoute =
	(typeof NUS_BUS_PROXY_ROUTES)[keyof typeof NUS_BUS_PROXY_ROUTES]

export function buildNUSBusProxyUrl(
	route: TNUSBusProxyRoute,
	params: Record<string, string> = {},
) {
	const url = new URL(`${nusBusProxyBaseUrl}/${route}`)

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value)
	}

	return url.toString()
}

export function buildNUSBusProxyHeaders(apiKey: string, accessToken: string): HeadersInit {
	return {
		Accept: "application/json",
		Authorization: `Bearer ${accessToken}`,
		"Content-Type": "application/json",
		"X-API-KEY": apiKey,
	}
}

export function getNUSBusProxyApiKey() {
	const apiKey = process.env.NUS_ETA_TOKEN?.trim()
	if (!apiKey) {
		throw new Error("NUS_ETA_TOKEN is not configured")
	}

	return apiKey
}
