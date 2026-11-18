import { mkdir, rename, writeFile } from "fs/promises"
import path from "path"
import { TBusServiceJSON } from "@app-types/bus-service-type"
import { TBusStopJSON } from "@app-types/bus-stop-type"
import { getStaticCataloguePath } from "@utils/data-dir"

export type TStaticCatalogue = { busStops: TBusStopJSON; busServices: TBusServiceJSON }

/**
 * Saves the Static Catalogue on the data volume as one file, written to a temp file and renamed
 * over the old one, so a failed or interrupted write leaves the previous Bus Stops and Bus
 * Services in place together.
 */
export async function writeStaticCatalogue(catalogue: TStaticCatalogue) {
	const filePath = getStaticCataloguePath()
	const tempPath = `${filePath}.tmp`

	await mkdir(path.dirname(filePath), { recursive: true })
	await writeFile(tempPath, JSON.stringify(catalogue))
	await rename(tempPath, filePath)
	console.log("📄 Static Catalogue saved")
}
