import "dotenv/config"
import Koa from "koa"
import bodyParser from "koa-bodyparser"
import json from "koa-json"
import { zodRouter } from "koa-zod-router"
import { Settings } from "luxon"
import {
	generateJSON,
	getBusService,
	getBusStop,
	getNearbyBusStops,
	searchBusStops,
} from "./routes"
import { searchBusServices } from "./routes/searchBusServices"
import KoaLogger from "koa-logger"
import { getBusStopServices } from "./routes/getBusStopServices"

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

router.get("/", async (ctx) => {
	ctx.status = 200
	ctx.body = "Transito's server is running as expected!"
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
