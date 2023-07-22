import busStopsJSON from "../json/bus_stops.json"
import { LTABusStop } from "../types/bus-stop-type"

export function getBusStopFromCode(busStopCode: string): LTABusStop | undefined {
	return busStopsJSON.find((busStop) => busStop.BusStopCode === busStopCode)
}
