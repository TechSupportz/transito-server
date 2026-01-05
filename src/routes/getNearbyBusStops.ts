import { defineRoute } from "@utils/route-builder"
import getDistance from "geolib/es/getDistance"
import { z } from "zod"
import { busStops } from "../json"
import { NearbyBusStopSchema, TNearbyBusStop } from "../types/bus-stop-type"

export const getNearbyBusStops = defineRoute({
	method: "get",
	path: "/bus-stops/nearby",
	validate: {
		query: z.object({
			latitude: z.coerce.number().min(-90).max(90),
			longitude: z.coerce.number().min(-180).max(180),
			range: z.coerce.number().optional().default(500),
		}),
	},
	handler: async (ctx) => {
		const { latitude, longitude, range } = ctx.request.query

		const nearbyBusStops: TNearbyBusStop[] = []
		const userLocation = { latitude, longitude }

		for (const busStop of busStops) {
			const busStopLocation = { latitude: busStop.latitude, longitude: busStop.longitude }
			const distanceAway = getDistance(userLocation, busStopLocation)

			if (distanceAway <= range) {
				nearbyBusStops.push({
					busStop,
					distanceAway,
				})
			}
		}

		const parsedNearbyBusStops = await z
			.array(NearbyBusStopSchema)
			.safeParseAsync(nearbyBusStops)

		if (!parsedNearbyBusStops.success) {
			console.error(`❌ Error parsing bus route: ${parsedNearbyBusStops.error}`)
			ctx.status = 500
			ctx.body = {
				message: "Internal Server Error",
			}
			return
		}

		parsedNearbyBusStops.data.sort((a, b) => a.distanceAway - b.distanceAway)

		ctx.status = 200
		ctx.body = {
			count: parsedNearbyBusStops.data.length,
			data: parsedNearbyBusStops.data,
		}
		return
	},
})
