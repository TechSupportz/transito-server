import { mkdir, readFile, rename, writeFile } from "fs/promises"
import path from "path"
import {
	AnnouncementListSchema,
	TAnnouncement,
	TAnnouncementContent,
} from "@app-types/announcement-type"

function getAnnouncementsPath() {
	const dataDir = process.env.DATA_DIR || path.join(__dirname, "../../data")
	return path.join(dataDir, "announcements.json")
}

// Serialises writes so concurrent admin requests cannot drop each other's changes
let writeQueue: Promise<unknown> = Promise.resolve()

async function readAnnouncements(): Promise<TAnnouncement[]> {
	try {
		const contents = await readFile(getAnnouncementsPath(), "utf8")
		return AnnouncementListSchema.parse(JSON.parse(contents))
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
		throw error
	}
}

async function writeAnnouncements(announcements: TAnnouncement[]) {
	const filePath = getAnnouncementsPath()
	const tempPath = `${filePath}.tmp`
	await mkdir(path.dirname(filePath), { recursive: true })
	await writeFile(tempPath, JSON.stringify(announcements, null, "\t"))
	await rename(tempPath, filePath)
}

function updateAnnouncements<T>(
	update: (announcements: TAnnouncement[], now: Date) => { announcements: TAnnouncement[]; result: T },
): Promise<T> {
	const run = writeQueue.then(async () => {
		const now = new Date()
		const current = (await readAnnouncements()).filter(
			(announcement) => !isExpired(announcement, now),
		)
		const { announcements, result } = update(current, now)
		await writeAnnouncements(announcements)
		return result
	})
	writeQueue = run.catch(() => undefined)
	return run
}

function isExpired(announcement: TAnnouncement, now: Date) {
	return announcement.expiresAt !== undefined && Date.parse(announcement.expiresAt) <= now.getTime()
}

export function isAnnouncementActive(announcement: TAnnouncement, now: Date) {
	const hasStarted =
		announcement.startsAt === undefined || Date.parse(announcement.startsAt) <= now.getTime()
	return hasStarted && !isExpired(announcement, now)
}

export async function getActiveAnnouncements(now = new Date()) {
	await writeQueue
	return (await readAnnouncements()).filter((announcement) =>
		isAnnouncementActive(announcement, now),
	)
}

export function upsertAnnouncement(id: string, content: TAnnouncementContent) {
	return updateAnnouncements((announcements, now) => {
		const announcement: TAnnouncement = { id, ...content, updatedAt: now.toISOString() }
		const index = announcements.findIndex((existing) => existing.id === id)
		const created = index === -1

		if (created) {
			announcements.push(announcement)
		} else {
			announcements[index] = announcement
		}

		return { announcements, result: { announcement, created } }
	})
}

export function deleteAnnouncement(id: string) {
	return updateAnnouncements((announcements) => {
		const remaining = announcements.filter((announcement) => announcement.id !== id)
		return { announcements: remaining, result: remaining.length !== announcements.length }
	})
}
