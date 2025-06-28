import { DateTime } from "luxon"
import busServiceJSON from "./bus-services.json"
import busStopJSON from "./bus-stops.json"
import { TBusServiceJSON } from "../types/bus-service-type"
import { TBusStopJSON } from "../types/bus-stop-type"

export const busStops = (busStopJSON as TBusStopJSON).data
export const busServices = (busServiceJSON as TBusServiceJSON).data

export const busStopUpdatedAt = DateTime.fromISO((busStopJSON as TBusStopJSON).metadata)
export const busServiceUpdatedAt = DateTime.fromISO((busServiceJSON as TBusServiceJSON).metadata)
