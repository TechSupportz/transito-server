export type TUpstreamProvider = "nus"

/**
 * A failure caused by a transport data provider rather than by Transito's server, so clients can
 * tell a provider Outage apart from a server Outage.
 */
export class UpstreamError extends Error {
	/** Timeouts are reported separately because they never count as an Outage. */
	readonly timedOut: boolean

	constructor(
		readonly provider: TUpstreamProvider,
		message: string,
		options?: { cause?: unknown; timedOut?: boolean },
	) {
		super(message, options)
		this.name = "UpstreamError"
		this.timedOut = options?.timedOut ?? false
	}
}

const TIMEOUT_ERROR_CODES = new Set([
	"ETIMEDOUT",
	"UND_ERR_CONNECT_TIMEOUT",
	"UND_ERR_HEADERS_TIMEOUT",
	"UND_ERR_BODY_TIMEOUT",
])

/** Whether [error], or any error in its cause chain, is a request timeout. */
export function isTimeoutError(error: unknown): boolean {
	for (let current = error, depth = 0; current && depth < 5; depth++) {
		const { name, code, cause } = current as { name?: string; code?: string; cause?: unknown }
		if (name === "TimeoutError" || (code !== undefined && TIMEOUT_ERROR_CODES.has(code))) {
			return true
		}
		current = cause
	}
	return false
}
