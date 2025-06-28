import { busServices } from "../json"
import { TBusService } from "../types/bus-service-type"

export function getBusServiceFromServiceNo(serviceNo: string): TBusService | undefined {
	return busServices.find((busService) => busService.serviceNo === serviceNo)
}
