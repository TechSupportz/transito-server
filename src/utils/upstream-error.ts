export type TUpstreamProvider = "nus"

/**
 * A failure caused by a transport data provider rather than by Transito's server, so clients can
 * tell a provider Outage apart from a server Outage.
 */
export class UpstreamError extends Error {
	constructor(
		readonly provider: TUpstreamProvider,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options)
		this.name = "UpstreamError"
	}
}
