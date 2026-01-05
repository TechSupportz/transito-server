import { DateTime } from "luxon"
import { OneMapTokenResponseSchema, TOneMapTokenResponse } from "../types/one-map-type"
import { oneMapBaseUrl } from "@utils/one-map-api"
import { zodFetch } from "@utils/zod-fetch"

let oneMapToken: TOneMapTokenResponse | null = null

async function fetchNewOneMapToken() {
	try {
		const res = await zodFetch(
			`${oneMapBaseUrl}/api/auth/post/getToken`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email: process.env.ONEMAP_EMAIL,
					password: process.env.ONEMAP_PASSWORD,
				}),
			},
			OneMapTokenResponseSchema,
		)

		oneMapToken = {
			access_token: res.access_token,
			expiry_timestamp: res.expiry_timestamp,
		}
	} catch (error) {
		console.error("Error fetching OneMap token:", error)
		oneMapToken = null
		throw new Error("Failed to fetch OneMap token")
	}
}

export async function getOneMapToken(): Promise<string | null> {
	if (
		oneMapToken &&
		oneMapToken.expiry_timestamp > DateTime.now().minus({ hours: 12 }).toSeconds()
	) {
		return oneMapToken.access_token
	}

	await fetchNewOneMapToken()
	return oneMapToken ? oneMapToken.access_token : null
}
