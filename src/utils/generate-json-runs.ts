import { mkdir, readFile, rename, writeFile } from "fs/promises"
import path from "path"
import {
	GenerateJSONRunSchema,
	TGenerateJSONRun,
	TGenerateJSONSummary,
} from "@app-types/generate-json-run-type"

// A run outlives Cloudflare's 125 s proxy timeout, so callers start it and read the outcome later.
// The record is kept on the data volume because a successful run restarts the server.
function getLastRunPath() {
	const dataDir = process.env.DATA_DIR || path.join(__dirname, "../../data")
	return path.join(dataDir, "last-generate-json-run.json")
}

let activeRun: { startedAt: string; done: Promise<TGenerateJSONRun> } | null = null

export function getActiveGenerateJSONRun() {
	return activeRun
}

/**
 * Starts `generate` in the background unless a run is already going, recording the run's status
 * as it starts and finishes. Never rejects: a failure is recorded as a failed run.
 */
export function startGenerateJSONRun(generate: () => Promise<TGenerateJSONSummary>) {
	if (activeRun) {
		return { started: false as const, startedAt: activeRun.startedAt }
	}

	const startedAt = new Date().toISOString()
	const done = (async (): Promise<TGenerateJSONRun> => {
		let run: TGenerateJSONRun

		try {
			await writeLastGenerateJSONRun({ startedAt, status: "running" })
			const summary = await generate()
			run = { startedAt, finishedAt: new Date().toISOString(), status: "succeeded", summary }
		} catch (error) {
			run = {
				startedAt,
				finishedAt: new Date().toISOString(),
				status: "failed",
				error: String(error),
			}
		}

		try {
			await writeLastGenerateJSONRun(run)
		} catch (error) {
			console.error("❌ Error saving the generate-json run:", error)
		}

		activeRun = null
		return run
	})()

	activeRun = { startedAt, done }
	return { started: true as const, startedAt, done }
}

export async function readLastGenerateJSONRun(): Promise<TGenerateJSONRun | null> {
	try {
		return GenerateJSONRunSchema.parse(JSON.parse(await readFile(getLastRunPath(), "utf8")))
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null
		throw error
	}
}

async function writeLastGenerateJSONRun(run: TGenerateJSONRun) {
	const filePath = getLastRunPath()
	const tempPath = `${filePath}.tmp`
	await mkdir(path.dirname(filePath), { recursive: true })
	await writeFile(tempPath, JSON.stringify(run, null, "\t"))
	await rename(tempPath, filePath)
}
