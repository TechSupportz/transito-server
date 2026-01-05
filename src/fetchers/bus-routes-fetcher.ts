import { z } from "zod"
import {
	TLTABusRoute,
	LTABusRouteResponseSchema,
	LTABusRouteSchema,
} from "@app-types/bus-route-type"
import { ltaAPIHeaders, ltaBaseUrl } from "@utils/lta-api"
import { zodFetch } from "@utils/zod-fetch"

const busRouteApiUrl = `${ltaBaseUrl}/BusRoutes`

async function getBusRoutes(skip: number = 0): Promise<TLTABusRoute[]> {
	try {
		const res = await zodFetch(
			`${busRouteApiUrl}?$skip=${skip}`,
			{
				headers: ltaAPIHeaders,
			},
			LTABusRouteResponseSchema,
		)

		return res.value
	} catch (error) {
		console.error(`❌ Error fetching bus routes: ${error}`)
		return Promise.reject(error)
	}
}

async function generateBusRoutesJSON() {
	let skipNumber = 500
	let busRouteJson = await getBusRoutes()

	if (busRouteJson) {
		while (true) {
			const busRoutes = await getBusRoutes(skipNumber)
			if (busRoutes && busRoutes.length === 0) {
				const parsed = await z.array(LTABusRouteSchema).safeParseAsync(busRouteJson)

				if (!parsed.success) {
					console.error(`❌ Error parsing bus routes: ${parsed.error}`)
					return Promise.reject(parsed.error)
				}

				return parsed.data
			} else {
				busRouteJson = busRouteJson.concat(busRoutes)
				skipNumber += 500
			}
		}
	}
}

export { generateBusRoutesJSON }
