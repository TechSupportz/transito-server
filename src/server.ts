import "dotenv/config"
import Koa from "koa"
import bodyParser from "koa-bodyparser"
import json from "koa-json"
import KoaLogger from "koa-logger"
import { zodRouter } from "koa-zod-router"
import { Settings } from "luxon"
import { busServiceUpdatedAt, busStopUpdatedAt } from "./json"
import {
	generateJSON,
	getBusService,
	getBusStop,
	getNearbyBusStops,
	searchBusStops,
} from "./routes"
import { getBusStopServices } from "./routes/getBusStopServices"
import { searchBusServices } from "./routes/searchBusServices"

const app = new Koa()
const router = zodRouter({
	zodRouter: {
		exposeRequestErrors: true,
		exposeResponseErrors: process.env.ENV === "dev" ? true : false,
	},
})

// Default timezone set to Singapore for Luxon
Settings.defaultLocale = "en_SG"

app.use(bodyParser())
app.use(json())
app.use(KoaLogger())

// Middleware to handle request delay for development environment
app.use(async (ctx, next) => {
	if (process.env.ENV !== "dev") {
		await next()
		return
	}

	const delay = 1000
	ctx.set("x-delay", `${delay}ms`)
	await new Promise((resolve) => setTimeout(resolve, delay))
	await next()
})

router.get("/", async (ctx) => {
	ctx.status = 200
	ctx.body = {
		message: "Transito's server is running as expected!",
		last_updated: { bus_stop: busStopUpdatedAt, bus_service: busServiceUpdatedAt },
	}
})

// JSON Routes
router.register(generateJSON)

// Bus Stop Routes
router.register(getBusStop)
router.register(searchBusStops)
router.register(getNearbyBusStops)
router.register(getBusStopServices)

// Bus Service Routes
router.register(getBusService)
router.register(searchBusServices)

app.use(router.routes())

const PORT = process.env.PORT || 8080

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`)
})
