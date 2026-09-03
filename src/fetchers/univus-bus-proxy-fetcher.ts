import { NUSBusProxyEnvelopeSchema } from "@app-types/univus-type"
import { getUnivusSession } from "@fetchers/univus-token-fetcher"
import {
	buildNUSBusProxyHeaders,
	buildNUSBusProxyUrl,
	getNUSBusProxyApiKey,
	TNUSBusProxyRoute,
} from "@utils/nus-api"
import { z } from "zod"

export async function fetchUnivusBusProxy<T>(
	route: TNUSBusProxyRoute,
	params: Record<string, string>,
	dataSchema: z.ZodType<T>,
): Promise<T> {
	const session = await getUnivusSession()
	if (!session) {
		throw new Error("Failed to fetch Univus session")
	}

	const res = await fetch(buildNUSBusProxyUrl(route), {
		method: "POST",
		headers: buildNUSBusProxyHeaders(getNUSBusProxyApiKey(), session.token),
		body: JSON.stringify({
			...params,
			token: session.token,
			userid: session.userid,
			domain: session.domain,
			deviceid: session.deviceid,
			ipaddr: session.ipaddr,
			version: session.version,
		}),
	})

	if (!res.ok) {
		throw new Error(`NUS bus proxy request failed with HTTP ${res.status}`)
	}

	const envelope = NUSBusProxyEnvelopeSchema.parse(await res.json())
	if (envelope.code !== "00000") {
		throw new Error(envelope.msg || `NUS bus proxy failed with code ${envelope.code}`)
	}

	return dataSchema.parseAsync(envelope.data)
}
