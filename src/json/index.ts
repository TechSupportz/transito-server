import { DateTime } from "luxon"
import busServiceJSON from "./bus-services.json"
import busStopJSON from "./bus-stops.json"
import { BusServiceJSON } from "../types/bus-service-type"
import { BusStopJSON } from "../types/bus-stop-type"

export const busStops = (busStopJSON as BusStopJSON).data
export const busServices = (busServiceJSON as BusServiceJSON).data

export const busStopUpdatedAt = DateTime.fromISO((busStopJSON as BusStopJSON).metadata)
export const busServiceUpdatedAt = DateTime.fromISO((busServiceJSON as BusServiceJSON).metadata)
