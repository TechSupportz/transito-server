import { afterEach, describe, expect, it, vi } from "vitest"
import { buildRoute } from "../../src/utils/route-builder"
import { generateJSON } from "../../src/routes/generateJSON"

describe("requiresSecret", () => {
	afterEach(() => {
		vi.unstubAllEnvs()
	})

	it("rejects an empty secret on POST /generate-json when the server has none set", async () => {
		const middlewares: Function[] = []
		const router = {
			post: (_path: string, ...handlers: Function[]) => middlewares.push(...handlers),
		}
		buildRoute(router as any, generateJSON)
		vi.stubEnv("SECRET", "")

		const ctx = { request: { headers: { secret: "" } } } as any
		let reachedHandler = false
		await middlewares[0](ctx, async () => {
			reachedHandler = true
		})

		expect(ctx.status).toBe(401)
		expect(reachedHandler).toBe(false)
	})
})
