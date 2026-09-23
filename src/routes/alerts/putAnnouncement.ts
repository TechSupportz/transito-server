import { z } from "zod"
import { AnnouncementContentSchema } from "@app-types/announcement-type"
import { upsertAnnouncement } from "@utils/announcements"
import { defineRoute } from "@utils/route-builder"

export const putAnnouncement = defineRoute({
	method: "put",
	path: "/alerts/announcements/:id",
	validate: {
		headers: z.object({ secret: z.string() }),
		params: z.object({
			id: z.string().min(1, { message: "Announcement id is required" }),
		}),
		body: AnnouncementContentSchema,
	},
	handler: async (ctx) => {
		if (!process.env.SECRET || ctx.request.headers.secret !== process.env.SECRET) {
			ctx.status = 401
			ctx.body = "Unauthorized"
			return
		}

		try {
			const { announcement, created } = await upsertAnnouncement(
				ctx.params.id,
				ctx.request.body,
			)

			ctx.status = created ? 201 : 200
			ctx.body = {
				message: created ? "Announcement created" : "Announcement updated",
				data: announcement,
			}
		} catch (error) {
			console.error("❌ Error saving announcement:", error)
			ctx.status = 500
			ctx.body = "Internal Server Error"
		}
	},
})
