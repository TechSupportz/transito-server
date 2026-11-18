import { fetchNUSActiveBuses, fetchNUSShuttleService } from "@fetchers/nus-eta-fetcher"
import {
	TLTABusArrival,
	TNUSActiveBus,
	TNUSArrivalEta,
	TNUSArrivalService,
	TNUSShuttle,
} from "@app-types/univus-type"
import { TBusRouteStop } from "@app-types/bus-route-type"
import { TBusService } from "@app-types/bus-service-type"
import { getBusServiceFromServiceNo } from "@utils/bus-services"
import { getNUSVisitNumber } from "@utils/nus-visit-number"
import { defineRoute } from "@utils/route-builder"
import { UpstreamError } from "@utils/upstream-error"
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

function getNUSBusService(serviceNo: string) {
	const busService = getBusServiceFromServiceNo(serviceNo)
	return busService?.operator === "NUS" ? busService : undefined
}

function getRouteBoundaryCodes(busService: TBusService | undefined) {
	if (!busService) {
		return { originCode: "", destinationCode: "" }
	}

	return {
		originCode: busService.interchanges[0]?.code ?? "",
		destinationCode: busService.interchanges[1]?.code ?? "",
	}
}

// Arrival Enrichment: a failure leaves the visit unknown rather than dropping the arrival
function getVisitNumber(
	route: TBusRouteStop[] | undefined,
	nusStopCode: string,
	activeBus: TNUSActiveBus | undefined,
) {
	try {
		return getNUSVisitNumber(
			route,
			nusStopCode,
			activeBus ? { latitude: activeBus.lat, longitude: activeBus.lng } : undefined,
		)
	} catch (error) {
		console.error(`Failed to work out NUS visit number at ${nusStopCode}:`, error)
		return ""
	}
}

type TArrivalContext = {
	activeBusByPlate: Map<string, TNUSActiveBus>
	originCode: string
	destinationCode: string
	route: TBusRouteStop[] | undefined
	nusStopCode: string
}

function getArrivalBus(
	eta: TNUSArrivalEta | undefined,
	{ activeBusByPlate, originCode, destinationCode, route, nusStopCode }: TArrivalContext,
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
		VisitNumber: getVisitNumber(route, nusStopCode, activeBus),
		Load: getNUSLoad(activeBus?.loadInfo?.crowdLevel),
		Feature: "",
		Type: "SD", //REVIEW - Could consider this to be something diff
	}
}

async function normalizeNUSShuttle(
	shuttle: TNUSShuttle,
	nusStopCode: string,
): Promise<TNUSArrivalService> {
	const activeBuses = await withFallback(
		fetchNUSActiveBuses(shuttle.name),
		[],
		`active buses for ${shuttle.name}`,
	)
	const activeBusByPlate = new Map(
		activeBuses.map((activeBus) => [activeBus.vehplate, activeBus]),
	)
	const busService = getNUSBusService(shuttle.name)
	// NUS Service Routes are single-direction
	const arrivalContext: TArrivalContext = {
		activeBusByPlate,
		...getRouteBoundaryCodes(busService),
		route: busService?.routes?.[0],
		nusStopCode,
	}
	const validEtas = getValidNUSEtas(shuttle._etas)

	return {
		ServiceNo: shuttle.name,
		Operator: "NUS",
		NextBus: getArrivalBus(validEtas[0], arrivalContext),
		NextBus2: getArrivalBus(validEtas[1], arrivalContext),
		NextBus3: getArrivalBus(validEtas[2], arrivalContext),
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
						.map((shuttle) => normalizeNUSShuttle(shuttle, ctx.params.code)),
				)
			).filter(hasAnyArrivalBus)

			ctx.status = 200
			ctx.body = {
				"odata.metadata": "",
				BusStopCode: ctx.params.code,
				Services: services,
			}
		} catch (error) {
			if (error instanceof UpstreamError) {
				// The app treats a 504 as a timeout, which never counts as a NUS Outage
				ctx.status = error.timedOut ? 504 : 502
				ctx.body = {
					message: "NUS bus arrivals are unavailable",
					provider: error.provider,
					error: error.message,
				}
				return
			}

			ctx.status = 500
			ctx.body = {
				message: "Error fetching NUS bus arrivals",
				error: error instanceof Error ? error.message : "Unknown error",
			}
		}
	},
})
