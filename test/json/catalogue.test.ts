import { mkdtemp, rm, writeFile } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { TBusServiceJSON } from "../../src/types/bus-service-type"
import { TBusStopJSON } from "../../src/types/bus-stop-type"

const basicStop = {
	code: "10001",
	name: "Main Int",
	roadName: "Main Rd",
	latitude: 1.3,
	longitude: 103.8,
	sources: { LTA: "10001" },
}
const savedBusStops: TBusStopJSON = {
	metadata: "2026-11-01T00:00:00.000+08:00",
	data: [{ ...basicStop, services: ["10"], searchTags: [] }],
}
const savedBusServices: TBusServiceJSON = {
	metadata: "2026-11-02T00:00:00.000+08:00",
	data: [
		{
			serviceNo: "10",
			operator: "SBST",
			isLoopService: true,
			isSingleRoute: true,
			interchanges: [basicStop, basicStop],
		},
	],
}

describe("Static Catalogue on the data volume", () => {
	let dataDir: string

	beforeEach(async () => {
		dataDir = await mkdtemp(path.join(tmpdir(), "transito-catalogue-"))
		vi.stubEnv("DATA_DIR", dataDir)
		vi.resetModules()
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "warn").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
	})

	afterEach(async () => {
		vi.unstubAllEnvs()
		vi.restoreAllMocks()
		await rm(dataDir, { recursive: true, force: true })
	})

	it("serves the catalogue saved by the last successful run", async () => {
		const { writeStaticCatalogue } = await import("../../src/utils/write-json")
		await writeStaticCatalogue({ busStops: savedBusStops, busServices: savedBusServices })

		const catalogue = await import("../../src/json")

		expect(catalogue.busStops).toEqual(savedBusStops.data)
		expect(catalogue.busServices).toEqual(savedBusServices.data)
		expect(catalogue.busStopUpdatedAt.toMillis()).toBe(Date.parse(savedBusStops.metadata))
		expect(catalogue.busServiceUpdatedAt.toMillis()).toBe(Date.parse(savedBusServices.metadata))
	})

	it.each([
		["is missing", null],
		["is not JSON", "{"],
		[
			"has invalid records",
			JSON.stringify({
				busStops: { ...savedBusStops, data: [null] },
				busServices: { ...savedBusServices, data: [null] },
			}),
		],
		[
			"is incomplete",
			JSON.stringify({
				busStops: savedBusStops,
				busServices: { metadata: "", data: [] },
			}),
		],
	])("falls back to the bundled catalogue when the saved file %s", async (_, contents) => {
		if (contents !== null) {
			const { getStaticCataloguePath } = await import("../../src/utils/data-dir")
			await writeFile(getStaticCataloguePath(), contents)
		}

		const bundledStops = (await import("../../src/json/bus-stops.json")).default
		const bundledServices = (await import("../../src/json/bus-services.json")).default
		const catalogue = await import("../../src/json")

		expect(catalogue.busStops).toEqual(bundledStops.data)
		expect(catalogue.busServices).toEqual(bundledServices.data)
	})
})
