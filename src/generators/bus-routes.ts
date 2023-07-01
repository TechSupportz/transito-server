import { writeFile } from "fs"
import { LTABusRouteResponse } from "../types/bus-route-type"
import { ltaAPIHeaders, ltaBaseUrl } from "../utils/lta-api"

const busRouteApiUrl = `${ltaBaseUrl}/BusRoutes`

async function getBusRoutes(skip: number = 0): Promise<LTABusRouteResponse> {
	try {
		const res = await fetch(`${busRouteApiUrl}?$skip=${skip}`, {
			headers: ltaAPIHeaders,
		})

		if (!res.ok) throw res.statusText

		return res.json()
	} catch (error) {
		console.error(`❌ Error fetching bus routes: ${error}`)
		return Promise.reject(error)
	}
}

async function generateBusRoutesJSON() {
	let skipNumber = 500
	let busRouteJson = await getBusRoutes()

	if (busRouteJson.value) {
		while (true) {
			const busRoutes = await getBusRoutes(skipNumber)
			if (busRoutes.value && busRoutes.value.length === 0) {
				return busRouteJson
			} else {
				busRouteJson.value = busRouteJson.value.concat(busRoutes.value)
				skipNumber += 500
			}
		}
	}
}

export { generateBusRoutesJSON }