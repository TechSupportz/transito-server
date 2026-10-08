import { describe, expect, it } from "vitest"
import { isTimeoutError } from "@utils/upstream-error"

describe("isTimeoutError", () => {
	it("detects abort-signal and undici timeouts, including nested causes", () => {
		expect(isTimeoutError(new DOMException("timed out", "TimeoutError"))).toBe(true)
		const connectTimeout = Object.assign(new Error("connect"), {
			code: "UND_ERR_CONNECT_TIMEOUT",
		})
		expect(isTimeoutError(new TypeError("fetch failed", { cause: connectTimeout }))).toBe(true)
	})

	it("does not treat other failures as timeouts", () => {
		const refused = Object.assign(new Error("refused"), { code: "ECONNREFUSED" })
		expect(isTimeoutError(new TypeError("fetch failed", { cause: refused }))).toBe(false)
		expect(isTimeoutError(new Error("NUS bus proxy request failed with HTTP 500"))).toBe(false)
	})
})
