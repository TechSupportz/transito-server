import { mkdir, readFile, rename, writeFile } from "fs/promises"
import path from "path"
import { getDataDir } from "@utils/data-dir"
import {
	GenerateJSONRunSchema,
	TGenerateJSONRun,
	TGenerateJSONSummary,
} from "@app-types/generate-json-run-type"

// A run outlives Cloudflare's 125 s proxy timeout, so callers start it and read the outcome later.
// The record is kept on the data volume because a successful run restarts the server.
function getLastRunPath() {
	return path.join(getDataDir(), "last-generate-json-run.json")
}

type TActiveRun = { startedAt: string; done?: Promise<TGenerateJSONRun>; finished: boolean }

// Set while a run goes and, after a success, until the process exits to load the new catalogue,
// so a second run cannot start and then be killed by that restart.
let activeRun: TActiveRun | null = null

/** The run still generating, or null once it has finished and its record is saved. */
export function getActiveGenerateJSONRun() {
	return activeRun && !activeRun.finished ? activeRun : null
}

/**
 * Starts `generate` in the background unless a run is already going or a successful run is
 * waiting for its restart, recording the run's status as it starts and finishes. Never rejects:
 * a failure is recorded as a failed run.
 */
export function startGenerateJSONRun(generate: () => Promise<TGenerateJSONSummary>) {
	if (activeRun) {
		return { started: false as const, startedAt: activeRun.startedAt }
	}

	const startedAt = new Date().toISOString()
	const reservation: TActiveRun = { startedAt, finished: false }
	activeRun = reservation

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

		// A successful run keeps its reservation: the server restarts next (src/routes/generateJSON.ts).
		if (run.status === "succeeded") {
			reservation.finished = true
		} else {
			activeRun = null
		}

		return run
	})()

	reservation.done = done
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
