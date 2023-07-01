import "dotenv/config"
import { writeFile } from "fs"
import { ltaAPIHeaders, ltaBaseUrl } from "../utils/lta-api"
import { LTABusServiceResponse } from "../types/bus-service-type"

const busServiceApiUrl = `${ltaBaseUrl}/BusServices`

async function getBusServices(skip: number = 0): Promise<LTABusServiceResponse> {
	try {
		const res = await fetch(`${busServiceApiUrl}?$skip=${skip}`, {
			headers: ltaAPIHeaders,
		})

		if (!res.ok) throw res.statusText

		return res.json()
	} catch (error) {
		console.error(`❌ Error fetching bus services: ${error}`)
		return Promise.reject(error)
	}
}

async function generateBusServicesJSON() {
	let skipNumber = 500
	let busServiceJson = await getBusServices()

	if (busServiceJson.value) {
		while (true) {
			const busServices = await getBusServices(skipNumber)
			if (busServices.value && busServices.value.length === 0) {
				writeFile("./src/json/bus_services.json", JSON.stringify(busServiceJson), (err) => {
					if (err) {
						console.error("❌ Error writing bus services file", err)
						Promise.reject(err)
						throw err
					} else {
						console.log("📄 Bus Services JSON file generated")
						Promise.resolve()
					}
				})
				break
			} else {
				busServiceJson.value = busServiceJson.value.concat(busServices.value)
				skipNumber += 500
			}
		}
	}
}

export { generateBusServicesJSON }
