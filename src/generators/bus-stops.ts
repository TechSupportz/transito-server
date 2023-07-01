import { writeFile } from "fs"
import { ltaAPIHeaders, ltaBaseUrl } from "../utils/lta-api"
import { LTABusStopResponse } from "../types/bus-stop-type"

const busStopApiUrl = `${ltaBaseUrl}/BusStops`

async function getBusStops(skip: number = 0): Promise<LTABusStopResponse> {
	try {
		const res = await fetch(`${busStopApiUrl}?$skip=${skip}`, {
			headers: ltaAPIHeaders,
		})

		if (!res.ok) throw res.statusText

		return res.json()
	} catch (error) {
		console.error(`❌ Error fetching bus stops: ${error}`)
		return Promise.reject(error)
	}
}

async function generateBusStopsJSON() {
	let skipNumber = 500
	let busStopJson = await getBusStops()

	if (busStopJson.value) {
		while (true) {
			const busStops = await getBusStops(skipNumber)
			if (busStops.value && busStops.value.length === 0) {
				writeFile("./src/json/bus_stops.json", JSON.stringify(busStopJson), (err) => {
					if (err) {
						console.error("❌ Error writing bus stops file", err)
						Promise.reject(err)
						throw err
					} else {
						console.log("📄 Bus Stop JSON file generated")
						Promise.resolve()
					}
				})
				break
			} else {
				busStopJson.value = busStopJson.value.concat(busStops.value)
				skipNumber += 500
			}
		}
	}
}

export { generateBusStopsJSON }
