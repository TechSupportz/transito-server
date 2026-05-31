export const nusETABaseUrl = "https://fms.connectx.com.sg/apiy/NUSETA"

export const nusETAToken = process.env.NUS_ETA_TOKEN ?? ""
export const nusETAServiceID = "NUS"

export function buildNUSETAUrl(endpoint: string, params: Record<string, string> = {}) {
	const searchParams = new URLSearchParams({
		token: nusETAToken,
		ServiceID: nusETAServiceID,
		...params,
	})

	return `${nusETABaseUrl}/${endpoint}?${searchParams.toString()}`
}
