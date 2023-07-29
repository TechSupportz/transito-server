import busStopsJSON from "../json/bus-stops.json"
import { BusStop, LTABusStop } from "../types/bus-stop-type"

export function getBusStopFromCode(busStopCode: string): BusStop | undefined {
	return busStopsJSON.data.find((busStop) => busStop.code === busStopCode)
}
