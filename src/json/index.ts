import { readFileSync } from "fs"
import { DateTime } from "luxon"
import bundledBusServiceJSON from "./bus-services.json"
import bundledBusStopJSON from "./bus-stops.json"
import { BusServiceJSONSchema, TBusServiceJSON } from "@app-types/bus-service-type"
import { BusStopJSONSchema, TBusStopJSON } from "@app-types/bus-stop-type"
import { getStaticCataloguePath } from "@utils/data-dir"
import type { TStaticCatalogue } from "@utils/write-json"

/**
 * The Static Catalogue saved on the data volume by the last successful generate-json run, or the
 * files bundled with the build (empty in the image) before any run has succeeded. Bus Stops and
 * Bus Services always come from the same source.
 */
function loadStaticCatalogue(): TStaticCatalogue {
	const filePath = getStaticCataloguePath()
	const bundled = {
		busStops: bundledBusStopJSON as TBusStopJSON,
		busServices: bundledBusServiceJSON as TBusServiceJSON,
	}

	try {
		const saved = JSON.parse(readFileSync(filePath, "utf8"))
		// The schemas generate-json writes with, so a damaged file cannot replace a usable one.
		const busStops = BusStopJSONSchema.safeParse(saved?.busStops)
		const busServices = BusServiceJSONSchema.safeParse(saved?.busServices)

		if (
			busStops.success &&
			busServices.success &&
			busStops.data.data.length > 0 &&
			busServices.data.data.length > 0
		) {
			return { busStops: busStops.data, busServices: busServices.data }
		}

		console.warn(`⚠️ ${filePath} is invalid or incomplete, using the bundled Static Catalogue`)
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			console.error(
				`❌ Error reading ${filePath}, using the bundled Static Catalogue:`,
				error,
			)
		}
	}

	return bundled
}

const { busStops: busStopJSON, busServices: busServiceJSON } = loadStaticCatalogue()

export const busStops = busStopJSON.data
export const busServices = busServiceJSON.data

export const busStopUpdatedAt = DateTime.fromISO(busStopJSON.metadata)
export const busServiceUpdatedAt = DateTime.fromISO(busServiceJSON.metadata)
