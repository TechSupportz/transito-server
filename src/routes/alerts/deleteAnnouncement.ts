import { z } from "zod"
import { deleteAnnouncement as removeAnnouncement } from "@utils/announcements"
import { defineRoute } from "@utils/route-builder"

export const deleteAnnouncement = defineRoute({
	method: "delete",
	path: "/alerts/announcements/:id",
	validate: {
		headers: z.object({ secret: z.string() }),
		params: z.object({
			id: z.string().min(1, { message: "Announcement id is required" }),
		}),
	},
	handler: async (ctx) => {
		if (!process.env.SECRET || ctx.request.headers.secret !== process.env.SECRET) {
			ctx.status = 401
			ctx.body = "Unauthorized"
			return
		}

		try {
			const deleted = await removeAnnouncement(ctx.params.id)

			if (!deleted) {
				ctx.status = 404
				ctx.body = { message: "Announcement not found" }
				return
			}

			ctx.status = 200
			ctx.body = { message: "Announcement deleted" }
		} catch (error) {
			console.error("❌ Error deleting announcement:", error)
			ctx.status = 500
			ctx.body = "Internal Server Error"
		}
	},
})
