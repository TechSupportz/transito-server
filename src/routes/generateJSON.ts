import { generateSearchTags, getBusStopFromCode } from "@utils/bus-stops"
import { defineRoute } from "@utils/route-builder"
import { writeJSON } from "@utils/write-json"
import { appendUniqueValues } from "@utils/array"
import { groupBy } from "lodash"
import { DateTime } from "luxon"
import { z } from "zod"
import { generateBusRoutesJSON } from "@fetchers/bus-routes-fetcher"
import { generateBusServicesJSON } from "@fetchers/bus-services-fetcher"
import { generateBusStopsJSON } from "@fetchers/bus-stops-fetcher"
import { fetchNUSPickupPoints, fetchNUSRouteMinMaxTimes } from "@fetchers/nus-eta-fetcher"
import { fetchUnivusBusStops } from "@fetchers/univus-maps-data-fetcher"
import { BusRouteStopSchema, TBusRouteStop, TLTABusRoute } from "@app-types/bus-route-type"
import {
	BusServiceJSONSchema,
	TBusService,
	TBusServiceJSON,
	TLTABusService,
} from "@app-types/bus-service-type"
import {
	BusStopJSONSchema,
	TBusStopJSON,
	TLTABusStop,
	TBasicBusStop,
	TTaggedBusStop,
} from "@app-types/bus-stop-type"
import { TNUSPickupPoint, TNUSRouteMinMaxTime, TUnivusBusStop } from "@app-types/univus-type"
import {
	NUS_SERVICE_CODES,
	NUS_TO_LTA_BUS_STOP_MAPPINGS,
	normalizeNUSPickupPointCode,
} from "@utils/nus-mappings"

export const generateJSON = defineRoute({
	method: "post",
	path: "/generate-json",
	validate: {
		headers: z.object({ secret: z.string() }),
	},
	handler: async (ctx) => {
		const { secret } = ctx.request.headers

		if (secret !== process.env.SECRET) {
			ctx.status = 401
			ctx.body = "Unauthorized"
			return
		}

		try {
			const [busStops, busServices, busRoutes, univusBusStops, nusStaticRouteData] =
				await Promise.all([
					generateBusStopsJSON(),
					generateBusServicesJSON(),
					generateBusRoutesJSON(),
					fetchUnivusBusStops(),
					fetchNUSStaticRouteData(),
				])

			if (!busStops || !busServices || !busRoutes || !univusBusStops || !nusStaticRouteData) {
				throw new Error("Failed to fetch raw bus data")
			}

			const ltaServiceNos = new Set(busServices.map((service) => service.ServiceNo))
			const transformedBusStops = await transformBusStops(
				busStops,
				busRoutes,
				nusStaticRouteData,
				univusBusStops,
				ltaServiceNos,
			)

			const transformedBusServices = await transformBusServices(
				busRoutes,
				busServices,
				transformedBusStops.data,
				nusStaticRouteData,
			)

			await writeJSON("bus-stops", transformedBusStops)
			await writeJSON("bus-services", transformedBusServices)

			ctx.status = 201
			ctx.body = {
				message: "JSON files generated",
			}

			setTimeout(() => {
				console.log("Restarting server...")
				process.exit()
			}, 5000)
		} catch (error) {
			console.error("❌ Error generating JSON:", error)
			ctx.status = 500
			ctx.body = "Internal Server Error"
			return
		}
	},
})

type TNUSStaticRoute = {
	serviceNo: string
	pickupPoints: TNUSPickupPoint[]
	times: TNUSRouteMinMaxTime[]
}

type TNUSStaticRouteData = TNUSStaticRoute[]

async function fetchNUSStaticRouteData(): Promise<TNUSStaticRouteData> {
	return Promise.all(
		NUS_SERVICE_CODES.map(async (serviceNo) => {
			const [pickupPoints, times] = await Promise.all([
				fetchNUSPickupPoints(serviceNo),
				fetchNUSRouteMinMaxTimes(serviceNo),
			])

			if (pickupPoints.length === 0) {
				throw new Error(`NUS service ${serviceNo} returned no pickup points`)
			}

			if (times.length === 0) {
				throw new Error(`NUS service ${serviceNo} returned no route timing data`)
			}

			return {
				serviceNo,
				pickupPoints,
				times,
			}
		}),
	)
}

function getNUSMapBusStopByCode(univusBusStops: TUnivusBusStop[]) {
	return new Map(univusBusStops.map((busStop) => [busStop.code, busStop]))
}

function getNUSStopSearchTags(
	stopCode: string,
	pickupPoint: TNUSPickupPoint,
	univusBusStop: TUnivusBusStop | undefined,
) {
	return [
		stopCode,
		pickupPoint.pickupname,
		pickupPoint.LongName,
		pickupPoint.ShortName,
		univusBusStop?.code,
		univusBusStop?.name,
		univusBusStop?.title,
	].filter((value): value is string => Boolean(value))
}

function getNUSStopName(pickupPoint: TNUSPickupPoint, univusBusStop: TUnivusBusStop | undefined) {
	return (
		univusBusStop?.title ||
		univusBusStop?.name ||
		pickupPoint.LongName ||
		pickupPoint.pickupname
	)
}

function formatBusScheduleTime(time: string) {
	if (time === "") {
		return time
	}

	const parsedTime = DateTime.fromFormat(time, "HHmm")
	return parsedTime.isValid ? parsedTime.toFormat("HH:mm") : time
}

function getNUSSchedule(
	times: TNUSRouteMinMaxTime[],
	field: "FirstTime" | "LastTime",
): { weekdays: string; saturday: string; sunday: string } {
	return {
		weekdays: formatBusScheduleTime(
			times.find((time) => time.DayType === "Mon-Fri")?.[field] ?? "",
		),
		saturday: formatBusScheduleTime(
			times.find((time) => time.DayType === "Sat")?.[field] ?? "",
		),
		sunday: formatBusScheduleTime(times.find((time) => time.DayType === "Sun")?.[field] ?? ""),
	}
}

function getBasicBusStop(code: string, busStopData: TTaggedBusStop[]): TBasicBusStop {
	const busStop = getBusStopFromCode(code, busStopData)

	if (!busStop) {
		throw new Error(`Bus stop ${code} not found in generated bus stop data`)
	}

	return {
		code: busStop.code,
		name: busStop.name,
		roadName: busStop.roadName,
		latitude: busStop.latitude,
		longitude: busStop.longitude,
		sources: busStop.sources,
	}
}

async function transformBusStops(
	busStops: TLTABusStop[],
	busRoutes: TLTABusRoute[],
	nusRoutes: TNUSStaticRouteData,
	univusBusStops: TUnivusBusStop[],
	ltaServiceNos: Set<string>,
): Promise<TBusStopJSON> {
	const tempBusStops: TTaggedBusStop[] = []

	for (const v of busStops) {
		const services = busRoutes.flatMap((route) => {
			if (route.BusStopCode === v.BusStopCode) {
				return route.ServiceNo
			} else {
				return []
			}
		})
		const searchTags = generateSearchTags(v.Description)

		const busStop: TTaggedBusStop = {
			code: v.BusStopCode,
			name: v.Description,
			roadName: v.RoadName,
			latitude: v.Latitude,
			longitude: v.Longitude,
			services: [...new Set(services)],
			sources: { LTA: v.BusStopCode },
			searchTags,
		}

		tempBusStops.push(busStop)
	}

	const nusMapBusStopByCode = getNUSMapBusStopByCode(univusBusStops)

	for (const route of nusRoutes) {
		if (ltaServiceNos.has(route.serviceNo)) {
			console.error(
				`Skipping NUS stop service interchanges for ${route.serviceNo} because it collides with an LTA service`,
			)
			continue
		}

		for (const pickupPoint of route.pickupPoints) {
			const nusStopCode = normalizeNUSPickupPointCode(
				pickupPoint.busstopcode,
				route.serviceNo,
			)
			const routeStopCode = NUS_TO_LTA_BUS_STOP_MAPPINGS[nusStopCode] ?? nusStopCode
			const existingStop = tempBusStops.find((busStop) => busStop.code === routeStopCode)
			const univusBusStop = nusMapBusStopByCode.get(nusStopCode)
			const searchTags = getNUSStopSearchTags(nusStopCode, pickupPoint, univusBusStop)

			if (existingStop) {
				existingStop.sources.NUS = nusStopCode
				appendUniqueValues(existingStop.services, [route.serviceNo])
				appendUniqueValues(existingStop.searchTags, searchTags)
				continue
			}

			const nusStopName = getNUSStopName(pickupPoint, univusBusStop)

			tempBusStops.push({
				code: routeStopCode,
				name: nusStopName,
				roadName: `NUS ${nusStopName}`,
				latitude: univusBusStop?.latitude ?? pickupPoint.lat,
				longitude: univusBusStop?.longitude ?? pickupPoint.lng,
				services: [route.serviceNo],
				sources: { NUS: nusStopCode },
				searchTags,
			})
		}
	}

	const parsedBusStops = await BusStopJSONSchema.safeParseAsync({
		metadata: DateTime.now().toISO(),
		data: tempBusStops,
	})

	if (!parsedBusStops.success) {
		console.error(`❌ Error parsing bus stops: ${parsedBusStops.error}`)
		throw new Error("Error parsing bus stops")
	}

	return parsedBusStops.data
}

async function transformBusServices(
	busRoutes: TLTABusRoute[],
	busServices: TLTABusService[],
	busStopData: TTaggedBusStop[],
	nusRoutes: TNUSStaticRouteData,
): Promise<TBusServiceJSON> {
	const tempBusServices: TBusService[] = []

	for (const [i, v] of busServices.entries()) {
		if (i !== 0 && busServices[i - 1].ServiceNo === v.ServiceNo) {
			continue
		}

		const parsedBusRoutes = busRoutes.flatMap((route) => {
			if (route.ServiceNo === v.ServiceNo) {
				return {
					busStop: getBasicBusStop(route.BusStopCode, busStopData),
					direction: route.Direction,
					sequence: route.StopSequence,
					distance: route.Distance,
					firstBus: {
						weekdays: formatBusScheduleTime(route.WD_FirstBus),
						saturday: formatBusScheduleTime(route.SAT_FirstBus),
						sunday: formatBusScheduleTime(route.SUN_FirstBus),
					},
					lastBus: {
						weekdays: formatBusScheduleTime(route.WD_LastBus),
						saturday: formatBusScheduleTime(route.SAT_LastBus),
						sunday: formatBusScheduleTime(route.SUN_LastBus),
					},
				} satisfies TBusRouteStop
			} else {
				return []
			}
		})

		const routes = Object.values(groupBy(parsedBusRoutes, "direction"))

		const parsed = await z.array(z.array(BusRouteStopSchema)).safeParseAsync(routes)

		if (!parsed.success) {
			console.error(`❌ Error parsing bus route: ${parsed.error}`)
			throw new Error("Error parsing bus route")
		}

		const busService: TBusService = {
			serviceNo: v.ServiceNo,
			interchanges: [
				getBasicBusStop(v.OriginCode, busStopData),
				getBasicBusStop(v.DestinationCode, busStopData),
			],
			operator: v.Operator,
			isLoopService: v.LoopDesc !== "",
			isSingleRoute: routes.length === 1,
			routes,
		}

		tempBusServices.push(busService)
	}

	const ltaServiceNos = new Set(tempBusServices.map((service) => service.serviceNo))

	for (const route of nusRoutes) {
		if (ltaServiceNos.has(route.serviceNo)) {
			console.error(
				`Skipping NUS service ${route.serviceNo} because it collides with an LTA service`,
			)
			continue
		}

		const sortedPickupPoints = [...route.pickupPoints].sort((a, b) => a.seq - b.seq)
		const routeStopCodes = sortedPickupPoints.map((pickupPoint) => {
			const nusStopCode = normalizeNUSPickupPointCode(
				pickupPoint.busstopcode,
				route.serviceNo,
			)
			return NUS_TO_LTA_BUS_STOP_MAPPINGS[nusStopCode] ?? nusStopCode
		})
		const firstBus = getNUSSchedule(route.times, "FirstTime")
		const lastBus = getNUSSchedule(route.times, "LastTime")

		const routeStops = sortedPickupPoints.map((_, index) => {
			const routeStopCode = routeStopCodes[index]

			return {
				busStop: getBasicBusStop(routeStopCode, busStopData),
				direction: 1,
				sequence: index + 1,
				distance: 0,
				firstBus,
				lastBus,
			} satisfies TBusRouteStop
		})

		const parsed = await z.array(BusRouteStopSchema).safeParseAsync(routeStops)

		if (!parsed.success) {
			console.error(`❌ Error parsing NUS bus route: ${parsed.error}`)
			throw new Error("Error parsing NUS bus route")
		}

		const firstStopCode = routeStopCodes[0] ?? "-"
		const lastStopCode = routeStopCodes[routeStopCodes.length - 1] ?? firstStopCode

		const isLoopService = firstStopCode === lastStopCode

		tempBusServices.push({
			serviceNo: route.serviceNo,
			interchanges: [
				getBasicBusStop(firstStopCode, busStopData),
				getBasicBusStop(isLoopService ? firstStopCode : lastStopCode, busStopData),
			],
			operator: "NUS",
			isLoopService,
			isSingleRoute: true,
			routes: [routeStops],
		})
	}

	const parsedBusServices = await BusServiceJSONSchema.safeParseAsync({
		metadata: DateTime.now().toISO(),
		data: tempBusServices,
	})

	if (!parsedBusServices.success) {
		console.error(`❌ Error parsing bus service: ${parsedBusServices.error}`)
		throw new Error("Error parsing bus service")
	}

	return parsedBusServices.data
}
