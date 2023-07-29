import "dotenv/config"
import Koa from "koa"
import bodyParser from "koa-bodyparser"
import json from "koa-json"
import { zodRouter } from "koa-zod-router"
import { generateJSON } from "./routes/generateJSON"

const app = new Koa()
const router = zodRouter()

app.use(bodyParser())
app.use(json())

router.get("/", async (ctx) => {
	ctx.status = 200
	ctx.body = "Transito's server is running as expected!"
})

router.register(generateJSON)

app.use(router.routes())

app.listen(8080, () => {
	console.log(`Server running on http://localhost:8080`)
})
