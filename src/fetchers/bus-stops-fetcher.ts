import { writeFile } from "fs"
import { LTABusStop, LTABusStopResponseSchema, LTABusStopSchema } from "../types/bus-stop-type"
import { ltaAPIHeaders, ltaBaseUrl } from "../utils/lta-api"
import { zodFetch } from "../utils/zod-fetch"
import { z } from "zod"

const busStopApiUrl = `${ltaBaseUrl}/BusStops`

async function getBusStops(skip: number = 0): Promise<LTABusStop[]> {
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

				writeFile("./src/json/bus_stops.json", JSON.stringify(busStopJSON), (err) => {
					if (err) {
						console.error("❌ Error writing bus stops file", err)
						Promise.reject(err)
						throw err
					} else {
						console.log("📄 Bus Stop JSON file generated")
						Promise.resolve()
					}
				})

				return parsed.data
			} else {
				busStopJSON = busStopJSON.concat(busStops)
				skipNumber += 500
			}
		}
	}
}

export { generateBusStopsJSON }
