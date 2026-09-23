import { z } from "zod"

export const AnnouncementSeveritySchema = z.enum(["info", "warning", "critical"])

export const AnnouncementContentSchema = z
	.object({
		title: z.string().trim().min(1, { message: "Title is required" }).max(120),
		body: z.string().trim().min(1, { message: "Body is required" }).max(1000),
		severity: AnnouncementSeveritySchema,
		startsAt: z.iso.datetime({ offset: true }).optional(),
		expiresAt: z.iso.datetime({ offset: true }).optional(),
	})
	.refine(
		({ startsAt, expiresAt }) =>
			!startsAt || !expiresAt || Date.parse(startsAt) < Date.parse(expiresAt),
		{ message: "expiresAt must be after startsAt", path: ["expiresAt"] },
	)
	.refine(({ expiresAt }) => !expiresAt || Date.parse(expiresAt) > Date.now(), {
		message: "expiresAt must be in the future",
		path: ["expiresAt"],
	})

export const AnnouncementSchema = z.object({
	id: z.string().min(1),
	title: z.string(),
	body: z.string(),
	severity: AnnouncementSeveritySchema,
	startsAt: z.string().optional(),
	expiresAt: z.string().optional(),
	updatedAt: z.string(),
})

export const AnnouncementListSchema = z.array(AnnouncementSchema)

export type TAnnouncementSeverity = z.infer<typeof AnnouncementSeveritySchema>
export type TAnnouncementContent = z.infer<typeof AnnouncementContentSchema>
export type TAnnouncement = z.infer<typeof AnnouncementSchema>
