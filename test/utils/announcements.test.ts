import { mkdtemp, readFile, rm } from "fs/promises"
import { tmpdir } from "os"
import path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	deleteAnnouncement,
	getActiveAnnouncements,
	upsertAnnouncement,
} from "@utils/announcements"
import { AnnouncementContentSchema } from "@app-types/announcement-type"

const content = { title: "Heads up", body: "NUS buses are delayed", severity: "info" as const }

describe("announcements", () => {
	let dataDir: string

	beforeEach(async () => {
		dataDir = await mkdtemp(path.join(tmpdir(), "transito-announcements-"))
		vi.stubEnv("DATA_DIR", dataDir)
	})

	afterEach(async () => {
		vi.unstubAllEnvs()
		vi.useRealTimers()
		await rm(dataDir, { recursive: true, force: true })
	})

	it("returns no announcements when the store does not exist yet", async () => {
		await expect(getActiveAnnouncements()).resolves.toEqual([])
	})

	it("creates, replaces, and deletes an announcement by id", async () => {
		const created = await upsertAnnouncement("nus-delay", content)
		expect(created.created).toBe(true)

		const replaced = await upsertAnnouncement("nus-delay", { ...content, severity: "critical" })
		expect(replaced.created).toBe(false)

		const active = await getActiveAnnouncements()
		expect(active).toHaveLength(1)
		expect(active[0]).toMatchObject({ id: "nus-delay", severity: "critical" })

		await expect(deleteAnnouncement("nus-delay")).resolves.toBe(true)
		await expect(deleteAnnouncement("nus-delay")).resolves.toBe(false)
		await expect(getActiveAnnouncements()).resolves.toEqual([])
	})

	it("only returns announcements inside their start and expiry window", async () => {
		const now = new Date("2026-09-23T12:00:00.000Z")

		await upsertAnnouncement("scheduled", { ...content, startsAt: "2026-09-24T00:00:00Z" })
		await upsertAnnouncement("live", {
			...content,
			startsAt: "2026-09-23T00:00:00Z",
			expiresAt: "2026-09-23T13:00:00Z",
		})

		const active = await getActiveAnnouncements(now)
		expect(active.map((announcement) => announcement.id)).toEqual(["live"])

		const later = new Date("2026-09-23T13:00:00.000Z")
		await expect(getActiveAnnouncements(later)).resolves.toEqual([])
	})

	it("prunes expired announcements when writing", async () => {
		vi.useFakeTimers({ toFake: ["Date"] })
		vi.setSystemTime(new Date("2026-09-23T12:00:00.000Z"))
		await upsertAnnouncement("old", { ...content, expiresAt: "2026-09-23T12:30:00Z" })

		vi.setSystemTime(new Date("2026-09-23T13:00:00.000Z"))
		await upsertAnnouncement("new", content)

		const stored = JSON.parse(await readFile(path.join(dataDir, "announcements.json"), "utf8"))
		expect(stored.map((announcement: { id: string }) => announcement.id)).toEqual(["new"])
	})

	it("keeps every concurrent write", async () => {
		await Promise.all(
			["a", "b", "c", "d"].map((id) => upsertAnnouncement(id, content)),
		)

		const active = await getActiveAnnouncements()
		expect(active.map((announcement) => announcement.id).sort()).toEqual(["a", "b", "c", "d"])
	})
})

describe("AnnouncementContentSchema", () => {
	it("rejects announcements that have already expired", () => {
		const result = AnnouncementContentSchema.safeParse({
			...content,
			expiresAt: "2000-01-01T00:00:00Z",
		})

		expect(result.success).toBe(false)
	})
})
