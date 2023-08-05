import busServicesJSON from "../json/bus-services.json"
import { BusService, BusServiceJSON } from "../types/bus-service-type"

export function getBusServiceFromServiceNo(serviceNo: string): BusService | undefined {
	return (busServicesJSON as BusServiceJSON).data.find(
		(busService) => busService.serviceNo === serviceNo,
	)
}
