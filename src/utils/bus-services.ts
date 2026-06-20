import { busServices } from "@json"
import { TBusStopServiceInterchange } from "@app-types/bus-stop-type"
import { TBusService } from "@app-types/bus-service-type"

export function getBusServiceFromServiceNo(serviceNo: string): TBusService | undefined {
	return busServices.find((busService) => busService.serviceNo === serviceNo)
}

export function getBusStopServiceInterchanges(
	busStopCode: string,
	serviceNos: string[],
): TBusStopServiceInterchange[] {
	return serviceNos.flatMap((serviceNo) => {
		const busService = getBusServiceFromServiceNo(serviceNo)

		if (!busService?.routes) {
			return []
		}

		return busService.routes.flatMap((route) => {
			const serviceRouteStop = route.find((routeStop) => routeStop.busStop.code === busStopCode)
			const originStopCode = route[0]?.busStop.code
			const destinationStopCode = route[route.length - 1]?.busStop.code

			if (!serviceRouteStop || !originStopCode || !destinationStopCode) {
				return []
			}

			return {
				serviceNo,
				originStopCode,
				destinationStopCode,
				direction: serviceRouteStop.direction,
			}
		})
	})
}
