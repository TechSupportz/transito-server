import { getOneMapToken } from "@fetchers/one-map-token-fetcher"

export const oneMapBaseUrl = "https://www.onemap.gov.sg"

export const getOneMapHeaders = async () => {
	const token = await getOneMapToken()
	if (!token) {
		throw new Error("Failed to fetch OneMap token")
	}

	return {
		Authorization: `${token}`,
	}
}
