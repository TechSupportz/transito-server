import { busStops } from "../json"
import { BusStop } from "../types/bus-stop-type"

export function getBusStopFromCode(busStopCode: string): BusStop | undefined {
	return busStops.find((busStop) => busStop.code === busStopCode)
}

export function isBusStopCode(busStopCode: string): boolean {
	return /^\d{5}$/.test(busStopCode)
}
