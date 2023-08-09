import { busStops } from "../json"
import { BusStop, BusStopJSON } from "../types/bus-stop-type"

export function getBusStopFromCode(busStopCode: string): BusStop | undefined {
	return busStops.find((busStop) => busStop.code === busStopCode)
}
