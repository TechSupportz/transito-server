import { DateTime } from "luxon"
import { randomUUID } from "crypto"
import {
	TUnivusAccessTokenResponse,
	UnivusAccessTokenResponseSchema,
	UnivusJwtPayloadSchema,
} from "@app-types/univus-type"
import { univusAPIHeaders, univusPublicBaseUrl } from "@utils/univus-api"
import { zodFetch } from "@utils/zod-fetch"

let univusToken: (TUnivusAccessTokenResponse["data"] & { expiry_timestamp: number }) | null = null
const fallbackUnivusDeviceId = randomUUID()

function getUnivusDeviceId() {
	return process.env.UNIVUS_DEVICE_ID ?? fallbackUnivusDeviceId
}

function decodeUnivusTokenExpiry(token: string) {
	const [, payload] = token.split(".")
	if (!payload) {
		throw new Error("Invalid Univus token")
	}

	const parsedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
	const jwtPayload = UnivusJwtPayloadSchema.parse(parsedPayload)

	return jwtPayload.exp
}

async function fetchNewUnivusToken() {
	try {
		const res = await zodFetch(
			`${univusPublicBaseUrl}/mobile/get-access-token`,
			{
				method: "POST",
				headers: univusAPIHeaders,
				body: JSON.stringify({
					deviceid: getUnivusDeviceId(),
					ipaddr: process.env.UNIVUS_IP_ADDRESS ?? "",
					version: process.env.UNIVUS_VERSION ?? "",
				}),
			},
			UnivusAccessTokenResponseSchema,
		)

		if (res.code !== "00000") {
			throw new Error(res.msg || `Univus token request failed with code ${res.code}`)
		}

		univusToken = {
			...res.data,
			expiry_timestamp: decodeUnivusTokenExpiry(res.data.token),
		}
	} catch (error) {
		console.error("Error fetching Univus token:", error)
		univusToken = null
		throw new Error("Failed to fetch Univus token")
	}
}

export async function getUnivusSession() {
	if (
		univusToken &&
		univusToken.expiry_timestamp > DateTime.now().plus({ minutes: 5 }).toSeconds()
	) {
		return {
			...univusToken,
			deviceid: getUnivusDeviceId(),
		}
	}

	await fetchNewUnivusToken()
	return univusToken ? { ...univusToken, deviceid: getUnivusDeviceId() } : null
}

export async function getUnivusToken(): Promise<string | null> {
	const session = await getUnivusSession()
	return session ? session.token : null
}
