export type TFetchWithRetryOptions = {
	timeoutMs: number
	retries: number
}

/**
 * Fetches with a per-attempt timeout, retrying network errors, timeouts and 5xx responses. Other
 * responses, including 404, are returned as they are for the caller to handle.
 */
export async function fetchWithRetry(
	url: string,
	init: RequestInit,
	{ timeoutMs, retries }: TFetchWithRetryOptions,
): Promise<Response> {
	for (let attempt = 0; ; attempt++) {
		const isLastAttempt = attempt >= retries

		try {
			const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })

			if (res.status < 500 || isLastAttempt) {
				return res
			}
		} catch (error) {
			if (isLastAttempt) {
				throw error
			}
		}
	}
}
