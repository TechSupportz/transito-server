import "dotenv/config"
import { readFileSync } from "fs"
import path from "path"
import Koa from "koa"
import bodyParser from "koa-bodyparser"
import json from "koa-json"
import KoaLogger from "koa-logger"
import { Settings } from "luxon"
import { busServiceUpdatedAt, busStopUpdatedAt } from "@json"
import {
	deleteAnnouncement,
	generateJSON,
	getLastGenerateJSONRun,
	getAlerts,
	getBusService,
	getBusStop,
	getNearbyBusStops,
	getNUSBusArrivals,
	putAnnouncement,
	searchBusStops,
} from "@routes"
import { getBusStopServices } from "@routes/getBusStopServices"
import { searchBusServices } from "@routes/searchBusServices"
import { searchOneMap } from "@routes/one-map/searchOneMap"
import Router from "@koa/router"
import { buildRoute } from "@utils/route-builder"

// package.json sits one level above both src/ (dev) and dist/ (built image).
const { version } = JSON.parse(
	readFileSync(path.join(__dirname, "../package.json"), "utf8"),
) as { version: string }

const app = new Koa()
const router = new Router()

// Default locale set to Singapore for Luxon
Settings.defaultLocale = "en-SG"

app.use(bodyParser())
app.use(json())
app.use(KoaLogger())

// Middleware to handle request delay for development environment
app.use(async (ctx, next) => {
	if (process.env.ENV !== "dev") {
		await next()
		return
	}

	const delay = 0
	ctx.set("x-delay", `${delay}ms`)
	await new Promise((resolve) => setTimeout(resolve, delay))
	await next()
})

router.get("/", async (ctx) => {
	ctx.status = 200
	ctx.body = {
		message: `Transito's server is running as expected! Version ${version}`,
		last_updated: { bus_stop: busStopUpdatedAt, bus_service: busServiceUpdatedAt },
	}
})

// JSON Routes
buildRoute(router, generateJSON)
buildRoute(router, getLastGenerateJSONRun)

// Bus Stop Routes
buildRoute(router, getBusStop)
buildRoute(router, searchBusStops)
buildRoute(router, getNearbyBusStops)
buildRoute(router, getBusStopServices)

// Bus Service Routes
buildRoute(router, getBusService)
buildRoute(router, searchBusServices)

// OneMap Routes
buildRoute(router, searchOneMap)

// NUS Routes
buildRoute(router, getNUSBusArrivals)

// Alert Routes
buildRoute(router, getAlerts)
buildRoute(router, putAnnouncement)
buildRoute(router, deleteAnnouncement)

app.use(router.routes())

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`)
})
