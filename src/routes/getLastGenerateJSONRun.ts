import { defineRoute } from "@utils/route-builder"
import { getActiveGenerateJSONRun, readLastGenerateJSONRun } from "@utils/generate-json-runs"

export const getLastGenerateJSONRun = defineRoute({
	method: "get",
	path: "/generate-json/last-run",
	requiresSecret: true,
	handler: async (ctx) => {
		try {
			const activeRun = getActiveGenerateJSONRun()
			const data = activeRun
				? { startedAt: activeRun.startedAt, status: "running" }
				: await readLastGenerateJSONRun()

			ctx.status = 200
			ctx.body = {
				message: data
					? "Last JSON generation run found"
					: "JSON has not been generated yet",
				data,
			}
		} catch (error) {
			console.error("❌ Error reading the last generate-json run:", error)
			ctx.status = 500
			ctx.body = "Internal Server Error"
		}
	},
})
