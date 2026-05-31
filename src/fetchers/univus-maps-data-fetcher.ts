import {
	TUnivusBusStop,
	TUnivusMapsDataResponse,
	UnivusMapsDataResponseSchema,
} from "@app-types/univus-type"
import { getUnivusSession } from "@fetchers/univus-token-fetcher"
import { univusAPIHeaders, univusBaseUrl } from "@utils/univus-api"
import { zodFetch } from "@utils/zod-fetch"

export async function fetchUnivusMapsData(): Promise<TUnivusMapsDataResponse> {
	const session = await getUnivusSession()
	if (!session) {
		throw new Error("Failed to fetch Univus token")
	}

	const res = await zodFetch(
		`${univusBaseUrl}/mobile/mapvenue/get_init`,
		{
			method: "POST",
			headers: univusAPIHeaders,
			body: JSON.stringify({
				token: session.token,
				userid: session.userid,
				domain: session.domain,
				deviceid: session.deviceid,
				ipaddr: process.env.UNIVUS_IP_ADDRESS ?? "",
				version: process.env.UNIVUS_VERSION ?? "",
			}),
		},
		UnivusMapsDataResponseSchema,
	)

	if (res.code !== "00000") {
		throw new Error(res.msg || `Univus maps data request failed with code ${res.code}`)
	}

	return res
}

function isUnivusBusStop(mapDataItem: TUnivusBusStop) {
	return mapDataItem.category.some((category) => category.toLowerCase() === "bus stop")
}

export async function fetchUnivusBusStops(): Promise<TUnivusBusStop[]> {
	const mapsData = await fetchUnivusMapsData()
	return mapsData.data.filter(isUnivusBusStop)
}
