import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { gunzipSync } from "zlib"
import { TBusServiceJSON } from "@app-types/bus-service-type"
import { buildRouteDistanceIndex, encodeRouteDistanceIndex } from "@utils/route-distance-index"

const mocks = vi.hoisted(() => {
	const file = {
		exists: vi.fn(),
		getMetadata: vi.fn(),
		save: vi.fn(),
	}

	return {
		file,
		bucket: vi.fn(() => ({ file: vi.fn(() => file) })),
		getAccessToken: vi.fn(),
		initializeApp: vi.fn(() => ({ name: "[DEFAULT]" })),
	}
})

vi.mock("firebase-admin/app", () => ({
	applicationDefault: () => ({ getAccessToken: mocks.getAccessToken }),
	getApps: () => [],
	initializeApp: mocks.initializeApp,
}))

vi.mock("firebase-admin/storage", () => ({
	getStorage: () => ({ bucket: mocks.bucket }),
}))

import {
	publishRouteDistanceIndex,
	shouldUploadRouteDistanceIndex,
} from "@utils/route-distance-index-upload"

const schedule = { weekdays: "06:00", saturday: "06:00", sunday: "06:00" }

const busServices: TBusServiceJSON = {
	metadata: "2026-10-08T12:00:00.000+08:00",
	data: [
		{
			serviceNo: "10",
			operator: "SBST",
			isLoopService: false,
			isSingleRoute: true,
			interchanges: [
				{ code: "10009", name: "A", roadName: "", latitude: 1.28, longitude: 103.81, sources: {} },
				{ code: "10011", name: "B", roadName: "", latitude: 1.29, longitude: 103.82, sources: {} },
			],
			routes: [
				[
					{
						busStop: { code: "10009", name: "A", roadName: "", latitude: 1.28, longitude: 103.81, sources: {} },
						direction: 1,
						sequence: 1,
						distance: 0,
						firstBus: schedule,
						lastBus: schedule,
					},
					{
						busStop: { code: "10011", name: "B", roadName: "", latitude: 1.29, longitude: 103.82, sources: {} },
						direction: 1,
						sequence: 2,
						distance: 1.5,
						firstBus: schedule,
						lastBus: schedule,
					},
				],
			],
		},
	],
}

const encoded = encodeRouteDistanceIndex(buildRouteDistanceIndex(busServices.data))

describe("shouldUploadRouteDistanceIndex", () => {
	it("skips only when the stored hash matches", () => {
		expect(shouldUploadRouteDistanceIndex(encoded.contentHash, encoded.contentHash)).toBe(false)
		expect(shouldUploadRouteDistanceIndex("stale", encoded.contentHash)).toBe(true)
		expect(shouldUploadRouteDistanceIndex(undefined, encoded.contentHash)).toBe(true)
	})
})

describe("publishRouteDistanceIndex", () => {
	beforeEach(() => {
		vi.stubEnv("ENV", "prod")
		vi.stubEnv("FIREBASE_STORAGE_EMULATOR_HOST", "")
		vi.spyOn(console, "log").mockImplementation(() => {})
		vi.spyOn(console, "warn").mockImplementation(() => {})
		vi.spyOn(console, "error").mockImplementation(() => {})
		mocks.getAccessToken.mockReset().mockResolvedValue({ access_token: "t", expires_in: 3600 })
		mocks.file.exists.mockReset().mockResolvedValue([true])
		mocks.file.getMetadata.mockReset()
		mocks.file.save.mockReset().mockResolvedValue(undefined)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllEnvs()
		vi.restoreAllMocks()
	})

	it("does not upload when the stored content hash matches", async () => {
		mocks.file.getMetadata.mockResolvedValue([{ metadata: { contentHash: encoded.contentHash } }])

		await expect(publishRouteDistanceIndex(busServices)).resolves.toBe("unchanged")
		expect(mocks.file.save).not.toHaveBeenCalled()
	})

	it("uploads gzipped JSON with the hash and generation time when the content changed", async () => {
		mocks.file.getMetadata.mockResolvedValue([{ metadata: { contentHash: "stale" } }])

		await expect(publishRouteDistanceIndex(busServices)).resolves.toBe("uploaded")
		expect(mocks.initializeApp).toHaveBeenCalledWith(
			expect.objectContaining({ storageBucket: "transito-8f50c.appspot.com" }),
		)

		const [bytes, options] = mocks.file.save.mock.calls[0]
		expect(JSON.parse(gunzipSync(bytes).toString("utf8"))).not.toHaveProperty("generatedAt")
		expect(gunzipSync(bytes).toString("utf8")).toBe(encoded.json)
		expect(options).toEqual({
			resumable: false,
			timeout: 30_000,
			contentType: "application/gzip",
			metadata: {
				metadata: {
					contentHash: encoded.contentHash,
					generatedAt: busServices.metadata,
				},
			},
		})
	})

	it("uploads when there is no existing object", async () => {
		mocks.file.exists.mockResolvedValue([false])

		await expect(publishRouteDistanceIndex(busServices)).resolves.toBe("uploaded")
		expect(mocks.file.getMetadata).not.toHaveBeenCalled()
		expect(mocks.file.save).toHaveBeenCalledOnce()
	})

	it("skips with a single warning when credentials are missing", async () => {
		mocks.getAccessToken.mockRejectedValue(new Error("Could not load the default credentials"))

		await expect(publishRouteDistanceIndex(busServices)).resolves.toBe("skipped")
		expect(console.warn).toHaveBeenCalledOnce()
		expect(mocks.file.save).not.toHaveBeenCalled()
	})

	it("skips in dev unless the Storage emulator is configured", async () => {
		vi.stubEnv("ENV", "dev")

		await expect(publishRouteDistanceIndex(busServices)).resolves.toBe("skipped")
		expect(mocks.file.save).not.toHaveBeenCalled()

		vi.stubEnv("FIREBASE_STORAGE_EMULATOR_HOST", "localhost:9199")
		mocks.file.exists.mockResolvedValue([false])

		await expect(publishRouteDistanceIndex(busServices)).resolves.toBe("uploaded")
		expect(mocks.getAccessToken).not.toHaveBeenCalled()
	})

	it("gives up with a warning when the upload never finishes", async () => {
		vi.useFakeTimers()
		mocks.file.exists.mockResolvedValue([false])
		mocks.file.save.mockReturnValue(new Promise(() => {}))

		const result = publishRouteDistanceIndex(busServices)
		await vi.advanceTimersByTimeAsync(30_000)

		await expect(result).resolves.toBe("failed")
		expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("timed out after 30s"))
		vi.useRealTimers()
	})

	it("gives up when the credential check never finishes", async () => {
		vi.useFakeTimers()
		mocks.getAccessToken.mockReturnValue(new Promise(() => {}))

		const result = publishRouteDistanceIndex(busServices)
		await vi.advanceTimersByTimeAsync(30_000)

		await expect(result).resolves.toBe("failed")
		expect(mocks.file.save).not.toHaveBeenCalled()
		vi.useRealTimers()
	})

	it("logs and resolves when the upload fails", async () => {
		mocks.file.exists.mockResolvedValue([false])
		mocks.file.save.mockRejectedValue(new Error("403 Forbidden"))

		await expect(publishRouteDistanceIndex(busServices)).resolves.toBe("failed")
		expect(console.error).toHaveBeenCalledOnce()
	})
})
