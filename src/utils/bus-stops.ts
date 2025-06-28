import { busStops } from "../json"
import { abbrMappings, TBusStop, TBusStopJSON } from "../types/bus-stop-type"

export function getBusStopFromCode(
	busStopCode: string,
	busStopData?: TBusStopJSON["data"],
): TBusStop | undefined {
	const taggedBusStop = busStopData
		? busStopData.find((busStop) => busStop.code === busStopCode)
		: busStops.find((busStop) => busStop.code === busStopCode)

	if (taggedBusStop) {
		const { searchTags, ...busStop } = taggedBusStop
		return busStop
	}

	return undefined
}

export function isBusStopCode(busStopCode: string): boolean {
	return /^\d{5}$/.test(busStopCode)
}

export function generateSearchTags(busStopName: string): string[] {
	const busStopNameWords = busStopName.toLowerCase().split(" ")

	const searchTags = busStopNameWords.flatMap((word) => {
		if (abbrMappings.hasOwnProperty(word)) {
			return abbrMappings[word]
		}

		return []
	})

	return searchTags
}
