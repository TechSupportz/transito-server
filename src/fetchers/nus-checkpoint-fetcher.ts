import { NUSCheckpointDataSchema, TNUSCheckpoint } from "@app-types/univus-type"
import { fetchUnivusBusProxy } from "@fetchers/univus-bus-proxy-fetcher"
import { NUS_BUS_PROXY_ROUTES } from "@utils/nus-api"

// Checkpoints are only used to fill in route distances, so a failure falls back to unknown
// distances instead of failing the whole catalogue.
export async function fetchNUSCheckpoints(routeCode: string): Promise<TNUSCheckpoint[] | null> {
	try {
		const res = await fetchUnivusBusProxy(
			NUS_BUS_PROXY_ROUTES.checkpointBusStop,
			{ route_code: routeCode },
			NUSCheckpointDataSchema,
		)

		return res.CheckPoint
	} catch (error) {
		console.warn(`⚠️ Error fetching NUS checkpoints for ${routeCode}: ${error}`)
		return null
	}
}
