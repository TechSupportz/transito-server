import {
	fetchNUSActiveBuses,
	fetchNUSPickupPoints,
	fetchNUSShuttleService,
} from "@fetchers/nus-eta-fetcher"
import { TNUSActiveBus, TNUSPickupPoint, TNUSShuttle } from "@app-types/univus-type"
import { defineRoute } from "@utils/route-builder"
import { NUS_TO_LTA_BUS_STOP_MAPPINGS, normalizeNUSPickupPointCode } from "@utils/nus-mappings"
import { DateTime } from "luxon"
import { z } from "zod"

type TArrivalBus = {
	OriginCode: string
	DestinationCode: string
	EstimatedArrival: string
	Monitored: number
	Latitude: string
	Longitude: string
	VisitNumber: string
	Load: string
	Feature: string
	Type: string
}

const emptyArrivalBus: TArrivalBus = {
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

type TNUSArrivalService = {
	ServiceNo: string
	Operator: "NUS"
	NextBus: TArrivalBus
	NextBus2: TArrivalBus
	NextBus3: TArrivalBus
}

const arrivalBusKeys = Object.keys(emptyArrivalBus) as (keyof TArrivalBus)[]

function isEmptyArrivalBus(arrivalBus: TArrivalBus) {
	return arrivalBusKeys.every((key) => arrivalBus[key] === emptyArrivalBus[key])
}

function hasAnyArrivalBus(service: TNUSArrivalService) {
	return [service.NextBus, service.NextBus2, service.NextBus3].some(
		(arrivalBus) => !isEmptyArrivalBus(arrivalBus),
	)
}

function getNUSRouteStopCode(busStopCode: string, routeCode: string) {
	const nusStopCode = normalizeNUSPickupPointCode(busStopCode, routeCode)
	return NUS_TO_LTA_BUS_STOP_MAPPINGS[nusStopCode] ?? nusStopCode
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

function formatNUSArrivalTime(timestamp: string) {
	const parsedTimestamp = DateTime.fromFormat(timestamp, "yyyy-MM-dd HH:mm:ss", {
		zone: "Asia/Singapore",
	})

	return parsedTimestamp.isValid
		? (parsedTimestamp.toISO({ suppressMilliseconds: true }) ?? "")
		: ""
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

function getRouteBoundaryCodes(routeCode: string, pickupPoints: TNUSPickupPoint[]) {
	const sortedPickupPoints = [...pickupPoints].sort((a, b) => a.seq - b.seq)
	const firstPickupPoint = sortedPickupPoints[0]
	const lastPickupPoint = sortedPickupPoints[sortedPickupPoints.length - 1]

	return {
		originCode: firstPickupPoint
			? getNUSRouteStopCode(firstPickupPoint.busstopcode, routeCode)
			: "",
		destinationCode: lastPickupPoint
			? getNUSRouteStopCode(lastPickupPoint.busstopcode, routeCode)
			: "",
	}
}

function getArrivalBus(
	shuttle: TNUSShuttle,
	index: number,
	activeBusByPlate: Map<string, TNUSActiveBus>,
	originCode: string,
	destinationCode: string,
): TArrivalBus {
	const eta = shuttle._etas[index]
	if (!eta) {
		return emptyArrivalBus
	}

	const activeBus = activeBusByPlate.get(eta.plate)

	return {
		OriginCode: originCode,
		DestinationCode: destinationCode,
		EstimatedArrival: formatNUSArrivalTime(eta.ts),
		Monitored: 1,
		Latitude: activeBus ? String(activeBus.lat) : "",
		Longitude: activeBus ? String(activeBus.lng) : "",
		VisitNumber: String(index + 1),
		Load: getNUSLoad(activeBus?.loadInfo.crowdLevel),
		Feature: "",
		Type: "SD", //REVIEW - Could consider this to be something diff
	}
}

async function normalizeNUSShuttle(shuttle: TNUSShuttle): Promise<TNUSArrivalService> {
	const [activeBuses, pickupPoints] = await Promise.all([
		withFallback(fetchNUSActiveBuses(shuttle.name), [], `active buses for ${shuttle.name}`),
		withFallback(fetchNUSPickupPoints(shuttle.name), [], `pickup points for ${shuttle.name}`),
	])
	const activeBusByPlate = new Map(
		activeBuses.map((activeBus) => [activeBus.vehplate, activeBus]),
	)
	const { originCode, destinationCode } = getRouteBoundaryCodes(shuttle.name, pickupPoints)

	return {
		ServiceNo: shuttle.name,
		Operator: "NUS",
		NextBus: getArrivalBus(shuttle, 0, activeBusByPlate, originCode, destinationCode),
		NextBus2: getArrivalBus(shuttle, 1, activeBusByPlate, originCode, destinationCode),
		NextBus3: getArrivalBus(shuttle, 2, activeBusByPlate, originCode, destinationCode),
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
			const services = (await Promise.all(shuttles.map(normalizeNUSShuttle))).filter(
				hasAnyArrivalBus,
			)

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
