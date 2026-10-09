import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	getUnivusSession: vi.fn(),
}))

vi.mock("@fetchers/univus-token-fetcher", () => ({
	getUnivusSession: mocks.getUnivusSession,
}))

import { NUSCheckpointSchema } from "@app-types/univus-type"
import { fetchNUSCheckpoints } from "@fetchers/nus-checkpoint-fetcher"

function response(data: unknown, code = "00000", msg = "") {
	return new Response(JSON.stringify({ data, code, msg, ts: "20261008120000" }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	})
}

describe("fetchNUSCheckpoints", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
		vi.stubEnv("NUS_ETA_TOKEN", "sanitized-runtime-key")
		mocks.getUnivusSession.mockResolvedValue({
			token: "sanitized-access-token",
			userid: "sanitized-userid",
			domain: "PUBLIC",
			deviceid: "sanitized-deviceid",
			ipaddr: "",
			version: "",
		})
	})

	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("posts the route code to the checkpoint route and unwraps the checkpoints", async () => {
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			response({
				CheckPoint: [
					{
						longitude: 103.769743,
						latitude: 1.294087,
						PointID: "1",
						routeid: 90287,
						isbusstop: true,
						busstopcode: "KRB-A1-S",
						busstoplongitude: 103.769836,
						busstoplatitude: 1.294068,
					},
					{
						longitude: 103.769727,
						latitude: 1.294046,
						PointID: "2",
						routeid: 90287,
						isbusstop: null,
						busstopcode: null,
						busstoplongitude: null,
						busstoplatitude: null,
					},
				],
			}),
		)

		const checkpoints = await fetchNUSCheckpoints("A1")

		expect(fetchMock.mock.calls[0][0]).toBe(
			"https://inetapps.nus.edu.sg/univus/api/bus-proxy/checkpoint-bus-stop",
		)
		expect(fetchMock.mock.calls[0][1]?.method).toBe("POST")
		expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
			route_code: "A1",
		})
		expect(checkpoints).toEqual([
			expect.objectContaining({ latitude: 1.294087, isbusstop: true, busstopcode: "KRB-A1-S" }),
			expect.objectContaining({ latitude: 1.294046, isbusstop: null }),
		])
	})

	it("accepts numeric strings but does not coerce missing coordinates to 0", () => {
		expect(NUSCheckpointSchema.parse({ latitude: "1.3", longitude: 103.7 })).toMatchObject({
			latitude: 1.3,
			longitude: 103.7,
		})
		expect(NUSCheckpointSchema.safeParse({ latitude: null, longitude: 103.7 }).success).toBe(false)
		expect(NUSCheckpointSchema.safeParse({ latitude: "", longitude: 103.7 }).success).toBe(false)
		expect(NUSCheckpointSchema.safeParse({ longitude: 103.7 }).success).toBe(false)
	})

	it("returns null when a checkpoint has no coordinates", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
		vi.spyOn(globalThis, "fetch").mockResolvedValue(
			response({
				CheckPoint: [
					{ latitude: 1.3, longitude: 103.7, isbusstop: true },
					{ latitude: null, longitude: null, isbusstop: null },
				],
			}),
		)

		await expect(fetchNUSCheckpoints("A1")).resolves.toBeNull()
		expect(warn).toHaveBeenCalledOnce()
	})

	it("returns null with a warning instead of failing", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
		vi.spyOn(globalThis, "fetch").mockResolvedValue(response({}, "20001", "Upstream unavailable"))

		await expect(fetchNUSCheckpoints("A1")).resolves.toBeNull()
		expect(warn).toHaveBeenCalledOnce()
	})
})
