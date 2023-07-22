import { writeFile } from "fs"
import {
	LTABusRoute,
	LTABusRouteResponse,
	LTABusRouteResponseSchema,
	LTABusRouteSchema,
} from "../types/bus-route-type"
import { ltaAPIHeaders, ltaBaseUrl } from "../utils/lta-api"
import { zodFetch } from "../utils/zod-fetch"
import {z} from "zod"

const busRouteApiUrl = `${ltaBaseUrl}/BusRoutes`

async function getBusRoutes(skip: number = 0): Promise<LTABusRoute[]> {
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

				writeFile("./src/json/bus_routes.json", JSON.stringify(busRouteJson), (err) => {
					if (err) {
						console.error("❌ Error writing bus routes file", err)
						Promise.reject(err)
						throw err
					} else {
						console.log("📄 Bus Routes JSON file generated")
						Promise.resolve()
					}
				})

				return parsed.data
			} else {
				busRouteJson = busRouteJson.concat(busRoutes)
				skipNumber += 500
			}
		}
	}
}

export { generateBusRoutesJSON }
