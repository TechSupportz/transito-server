import { OneMapBusRoutesResponseSchema, TOneMapBusRoutesResponse } from "@app-types/one-map-type"
import { fetchWithRetry } from "@utils/fetch-with-retry"
import { oneMapBaseUrl } from "@utils/one-map-api"

// Private endpoint behind OneMap's bus explorer page; it rejects requests without that Referer.
const ONE_MAP_BUS_ROUTES_URL = `${oneMapBaseUrl}/omapi/om/api/private/busexp/getBusRoutes`
const ONE_MAP_BUS_EXPLORER_URL = `${oneMapBaseUrl}/bus`

/** Stop-to-stop route segments for both directions of a bus service. */
export async function fetchOneMapBusRoutes(serviceNo: string): Promise<TOneMapBusRoutesResponse> {
	const res = await fetchWithRetry(
		`${ONE_MAP_BUS_ROUTES_URL}?busNo=${encodeURIComponent(serviceNo)}`,
		{ headers: { Referer: ONE_MAP_BUS_EXPLORER_URL } },
		{ timeoutMs: 10_000, retries: 1 },
	)

	if (!res.ok) {
		throw new Error(`HTTP ${res.status}`)
	}

	return OneMapBusRoutesResponseSchema.parseAsync(await res.json())
}
