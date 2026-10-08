import { z } from "zod"
import { AnnouncementContentSchema } from "@app-types/announcement-type"
import { upsertAnnouncement } from "@utils/announcements"
import { defineRoute } from "@utils/route-builder"

export const putAnnouncement = defineRoute({
	method: "put",
	path: "/alerts/announcements",
	requiresSecret: true,
	validate: {
		body: z.object({
			...AnnouncementContentSchema.shape,
			id: z.string().min(1, { message: "Announcement id is required" }),
			severity: z.union([z.literal(0), z.literal(1), z.literal(2)]),
		}),
	},
	handler: async (ctx) => {
		try {
			const { id, severity, ...body } = ctx.request.body
			const parsed = AnnouncementContentSchema.safeParse({
				...body,
				severity: (["info", "warning", "critical"] as const)[severity],
			})
			if (!parsed.success) {
				ctx.status = 422
				ctx.body = {
					message: `Validation Error: ${parsed.error.message}`,
					errors: parsed.error.issues,
				}
				return
			}
			const { announcement, created } = await upsertAnnouncement(id, parsed.data)

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
