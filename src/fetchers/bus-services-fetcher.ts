import "dotenv/config"
import {
	BusServiceSchema,
	LTABusService,
	LTABusServiceResponseSchema,
	LTABusServiceSchema,
} from "../types/bus-service-type"
import { ltaAPIHeaders, ltaBaseUrl } from "../utils/lta-api"
import { zodFetch } from "../utils/zod-fetch"
import { z } from "zod"

const busServiceApiUrl = `${ltaBaseUrl}/BusServices`

async function getBusServices(skip: number = 0): Promise<LTABusService[]> {
	try {
		const res = await zodFetch(
			`${busServiceApiUrl}?$skip=${skip}`,
			{
				headers: ltaAPIHeaders,
			},
			LTABusServiceResponseSchema,
		)

		return res.value
	} catch (error) {
		console.error(`❌ Error fetching bus services: ${error}`)
		return Promise.reject(error)
	}
}

async function generateBusServicesJSON() {
	let skipNumber = 500
	let busServiceJSON = await getBusServices()

	if (busServiceJSON) {
		while (true) {
			const busServices = await getBusServices(skipNumber)
			if (busServices && busServices.length === 0) {
				const parsed = await z.array(LTABusServiceSchema).safeParseAsync(busServiceJSON)

				if (!parsed.success) {
					console.error(`❌ Error parsing bus services: ${parsed.error}`)
					return Promise.reject(parsed.error)
				}

				return parsed.data
			} else {
				busServiceJSON = busServiceJSON.concat(busServices)
				skipNumber += 500
			}
		}
	}
}

export { generateBusServicesJSON }
