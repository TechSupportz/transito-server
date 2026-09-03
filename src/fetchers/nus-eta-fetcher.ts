import {
	NUSActiveBusDataSchema,
	NUSPickupPointDataSchema,
	NUSRouteMinMaxTimeDataSchema,
	NUSShuttleServiceDataSchema,
	TNUSActiveBus,
	TNUSPickupPoint,
	TNUSRouteMinMaxTime,
	TNUSShuttle,
} from "@app-types/univus-type"
import { fetchUnivusBusProxy } from "@fetchers/univus-bus-proxy-fetcher"
import { NUS_BUS_PROXY_ROUTES } from "@utils/nus-api"

export async function fetchNUSShuttleService(busStopCode: string): Promise<TNUSShuttle[]> {
	const res = await fetchUnivusBusProxy(
		NUS_BUS_PROXY_ROUTES.shuttleService,
		{ busstopname: busStopCode },
		NUSShuttleServiceDataSchema,
	)

	return res.shuttles
}

export async function fetchNUSPickupPoints(routeCode: string): Promise<TNUSPickupPoint[]> {
	const res = await fetchUnivusBusProxy(
		NUS_BUS_PROXY_ROUTES.pickupPoint,
		{ route_code: routeCode },
		NUSPickupPointDataSchema,
	)

	return res.pickuppoint
}

export async function fetchNUSRouteMinMaxTimes(routeCode: string): Promise<TNUSRouteMinMaxTime[]> {
	const res = await fetchUnivusBusProxy(
		NUS_BUS_PROXY_ROUTES.routeMinMaxTime,
		{ route_code: routeCode },
		NUSRouteMinMaxTimeDataSchema,
	)

	return res.RouteMinMaxTime
}

export async function fetchNUSActiveBuses(routeCode: string): Promise<TNUSActiveBus[]> {
	const res = await fetchUnivusBusProxy(
		NUS_BUS_PROXY_ROUTES.activeBus,
		{ route_code: routeCode },
		NUSActiveBusDataSchema,
	)

	return res.activebus
}
