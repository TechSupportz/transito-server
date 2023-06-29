import "dotenv/config"
import { writeFile } from "fs"
import { ltaAPIHeaders } from "../utils/api"
import { BusServiceResponse } from "../types/bus-services"

const busServiceApiUrl = `${process.env.LTA_API_URL}/BusServices`

async function getBusServices(skip: number = 0): Promise<BusServiceResponse> {
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

async function generateBusServicesJson() {
	let skipNumber = 500
	let busServiceJson = await getBusServices()

	if (busServiceJson.value) {
		while (true) {
			const busServices = await getBusServices(skipNumber)
			if (busServices.value && busServices.value.length === 0) {
				writeFile("./output/bus_services.json", JSON.stringify(busServiceJson), (err) => {
					if (err) {
						console.error("❌ Error writing file", err)
					}
				})
				console.log("🚌 Bus Services JSON file generated")
				return true
			} else {
				busServiceJson.value = busServiceJson.value.concat(busServices.value)
				skipNumber += 500
			}
		}
	}
}

export { generateBusServicesJson }
