import { z } from "zod"
import { TLTABusStop, LTABusStopResponseSchema, LTABusStopSchema } from "@app-types/bus-stop-type"
import { ltaAPIHeaders, ltaBaseUrl } from "@utils/lta-api"
import { zodFetch } from "@utils/zod-fetch"

const busStopApiUrl = `${ltaBaseUrl}/BusStops`

async function getBusStops(skip: number = 0): Promise<TLTABusStop[]> {
	try {
		const res = await zodFetch(
			`${busStopApiUrl}?$skip=${skip}`,
			{
				headers: ltaAPIHeaders,
			},
			LTABusStopResponseSchema,
		)

		return res.value
	} catch (error) {
		console.error(`❌ Error fetching bus stops: ${error}`)
		return Promise.reject(error)
	}
}

async function generateBusStopsJSON() {
	let skipNumber = 500
	let busStopJSON = await getBusStops()

	if (busStopJSON) {
		while (true) {
			const busStops = await getBusStops(skipNumber)
			if (busStops && busStops.length === 0) {
				const parsed = await z.array(LTABusStopSchema).safeParseAsync(busStopJSON)

				if (!parsed.success) {
					console.error(`❌ Error parsing bus stops: ${parsed.error}`)
					return Promise.reject(parsed.error)
				}

				return parsed.data
			} else {
				busStopJSON = busStopJSON.concat(busStops)
				skipNumber += 500
			}
		}
	}
}

export { generateBusStopsJSON }
