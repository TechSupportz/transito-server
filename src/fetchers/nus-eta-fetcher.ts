import {
	NUSActiveBusResponseSchema,
	NUSPickupPointResponseSchema,
	NUSRouteMinMaxTimeResponseSchema,
	NUSShuttleServiceResponseSchema,
	TNUSActiveBus,
	TNUSPickupPoint,
	TNUSRouteMinMaxTime,
	TNUSShuttle,
} from "@app-types/univus-type"
import { buildNUSETAUrl } from "@utils/nus-api"
import { zodFetch } from "@utils/zod-fetch"

export async function fetchNUSShuttleService(busStopCode: string): Promise<TNUSShuttle[]> {
	const res = await zodFetch(
		buildNUSETAUrl("ShuttleService", { busstopname: busStopCode }),
		{},
		NUSShuttleServiceResponseSchema,
	)

	return res.ShuttleServiceResult.shuttles
}

export async function fetchNUSPickupPoints(routeCode: string): Promise<TNUSPickupPoint[]> {
	const res = await zodFetch(
		buildNUSETAUrl("PickupPoint", { route_code: routeCode }),
		{},
		NUSPickupPointResponseSchema,
	)

	return res.PickupPointResult.pickuppoint
}

export async function fetchNUSRouteMinMaxTimes(routeCode: string): Promise<TNUSRouteMinMaxTime[]> {
	const res = await zodFetch(
		buildNUSETAUrl("RouteMinMaxTime", { route_code: routeCode }),
		{},
		NUSRouteMinMaxTimeResponseSchema,
	)

	return res.RouteMinMaxTimeResult.RouteMinMaxTime
}

export async function fetchNUSActiveBuses(routeCode: string): Promise<TNUSActiveBus[]> {
	const res = await zodFetch(
		buildNUSETAUrl("ActiveBus", { route_code: routeCode }),
		{},
		NUSActiveBusResponseSchema,
	)

	return res.ActiveBusResult.activebus
}
