import { getActiveAnnouncements } from "@utils/announcements"
import { defineRoute } from "@utils/route-builder"

export const getAlerts = defineRoute({
	method: "get",
	path: "/alerts",
	handler: async (ctx) => {
		try {
			const announcements = await getActiveAnnouncements()

			ctx.status = 200
			ctx.body = {
				message: "Active announcements",
				data: { announcements },
			}
		} catch (error) {
			console.error("❌ Error reading announcements:", error)
			ctx.status = 500
			ctx.body = {
				message: "Error reading announcements",
			}
		}
	},
})
