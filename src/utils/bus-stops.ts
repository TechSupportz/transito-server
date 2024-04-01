import { busStops } from "../json"
import { BusStop, BusStopJSON } from "../types/bus-stop-type"

export function getBusStopFromCode(
	busStopCode: string,
	busStopData?: BusStopJSON["data"],
): BusStop | undefined {
	if (busStopData) {
		return busStopData.find((busStop) => busStop.code === busStopCode)
	}

	return busStops.find((busStop) => busStop.code === busStopCode)
}

export function isBusStopCode(busStopCode: string): boolean {
	return /^\d{5}$/.test(busStopCode)
}
