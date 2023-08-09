import { busServices } from "../json"
import { BusService } from "../types/bus-service-type"

export function getBusServiceFromServiceNo(serviceNo: string): BusService | undefined {
	return busServices.find((busService) => busService.serviceNo === serviceNo)
}
