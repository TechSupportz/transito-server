import { fetchNUSActiveBuses, fetchNUSShuttleService } from "@fetchers/nus-eta-fetcher"
import {
	TLTABusArrival,
	TNUSActiveBus,
	TNUSArrivalEta,
	TNUSArrivalService,
	TNUSShuttle,
} from "@app-types/univus-type"
import { getBusServiceFromServiceNo } from "@utils/bus-services"
import { defineRoute } from "@utils/route-builder"
import { DateTime } from "luxon"
import { z } from "zod"

const emptyArrivalBus: TLTABusArrival = {
	OriginCode: "",
	DestinationCode: "",
	EstimatedArrival: "",
	Monitored: 0,
	Latitude: "",
	Longitude: "",
	VisitNumber: "",
	Load: "",
	Feature: "",
	Type: "",
}

const arrivalBusKeys = Object.keys(emptyArrivalBus) as (keyof TLTABusArrival)[]

function isEmptyArrivalBus(arrivalBus: TLTABusArrival) {
	return arrivalBusKeys.every((key) => arrivalBus[key] === emptyArrivalBus[key])
}

function hasAnyArrivalBus(service: TNUSArrivalService) {
	return [service.NextBus, service.NextBus2, service.NextBus3].some(
		(arrivalBus) => !isEmptyArrivalBus(arrivalBus),
	)
}

function getNUSLoad(crowdLevel: string | undefined) {
	switch (crowdLevel?.toLowerCase()) {
		case "low":
			return "SEA"
		case "medium":
			return "SDA"
		case "high":
			return "LSD"
		default:
			return ""
	}
}

function formatNUSArrivalTime(etaMinutes: number) {
	const arrivalTime = DateTime.now().setZone("Asia/Singapore").plus({ minutes: etaMinutes })
	const roundedArrivalTime =
		arrivalTime.second >= 30
			? arrivalTime.plus({ minutes: 1 }).startOf("minute")
			: arrivalTime.startOf("minute")

	return (
		roundedArrivalTime.toISO({
			suppressMilliseconds: true,
		}) ?? ""
	)
}

function getValidNUSEtas(etas: TNUSShuttle["_etas"]) {
	return etas.filter((eta) => eta.eta >= 0)
}

function isEndingTerminalShuttle(shuttle: TNUSShuttle) {
	return shuttle.busstopcode.endsWith("-E")
}

async function withFallback<T>(promise: Promise<T>, fallback: T, label: string) {
	try {
		return await Promise.race([
			promise,
			new Promise<T>((resolve) => {
				setTimeout(() => resolve(fallback), 3000)
			}),
		])
	} catch (error) {
		console.error(`Failed to enrich NUS arrival ${label}:`, error)
		return fallback
	}
}

function getRouteBoundaryCodes(routeCode: string) {
	const busService = getBusServiceFromServiceNo(routeCode)
	if (busService?.operator !== "NUS") {
		return { originCode: "", destinationCode: "" }
	}

	return {
		originCode: busService.interchanges[0]?.code ?? "",
		destinationCode: busService.interchanges[1]?.code ?? "",
	}
}

function getArrivalBus(
	eta: TNUSArrivalEta | undefined,
	activeBusByPlate: Map<string, TNUSActiveBus>,
	originCode: string,
	destinationCode: string,
): TLTABusArrival {
	if (!eta) {
		return emptyArrivalBus
	}

	const activeBus = activeBusByPlate.get(eta.plate)

	return {
		OriginCode: originCode,
		DestinationCode: destinationCode,
		EstimatedArrival: formatNUSArrivalTime(eta.eta),
		Monitored: activeBus ? 1 : 0,
		Latitude: activeBus ? String(activeBus.lat) : "",
		Longitude: activeBus ? String(activeBus.lng) : "",
		VisitNumber: "1",
		Load: getNUSLoad(activeBus?.loadInfo?.crowdLevel),
		Feature: "",
		Type: "SD", //REVIEW - Could consider this to be something diff
	}
}

async function normalizeNUSShuttle(shuttle: TNUSShuttle): Promise<TNUSArrivalService> {
	const activeBuses = await withFallback(
		fetchNUSActiveBuses(shuttle.name),
		[],
		`active buses for ${shuttle.name}`,
	)
	const activeBusByPlate = new Map(
		activeBuses.map((activeBus) => [activeBus.vehplate, activeBus]),
	)
	const { originCode, destinationCode } = getRouteBoundaryCodes(shuttle.name)
	const validEtas = getValidNUSEtas(shuttle._etas)

	return {
		ServiceNo: shuttle.name,
		Operator: "NUS",
		NextBus: getArrivalBus(validEtas[0], activeBusByPlate, originCode, destinationCode),
		NextBus2: getArrivalBus(validEtas[1], activeBusByPlate, originCode, destinationCode),
		NextBus3: getArrivalBus(validEtas[2], activeBusByPlate, originCode, destinationCode),
	}
}

export const getNUSBusArrivals = defineRoute({
	method: "get",
	path: "/bus-arrivals/nus/:code",
	validate: {
		params: z.object({
			code: z.string().min(1, { message: "Bus stop code is required" }),
		}),
	},
	handler: async (ctx) => {
		try {
			const shuttles = await fetchNUSShuttleService(ctx.params.code)
			const services = (
				await Promise.all(
					shuttles
						.filter((shuttle) => !isEndingTerminalShuttle(shuttle))
						.map(normalizeNUSShuttle),
				)
			).filter(hasAnyArrivalBus)

			ctx.status = 200
			ctx.body = {
				"odata.metadata": "",
				BusStopCode: ctx.params.code,
				Services: services,
			}
		} catch (error) {
			ctx.status = 500
			ctx.body = {
				message: "Error fetching NUS bus arrivals",
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})
