import { applicationDefault, getApps, initializeApp } from "firebase-admin/app"
import { getStorage } from "firebase-admin/storage"
import { TBusServiceJSON } from "@app-types/bus-service-type"
import {
	buildRouteDistanceIndex,
	encodeRouteDistanceIndex,
	TEncodedRouteDistanceIndex,
} from "@utils/route-distance-index"

export const ROUTE_DISTANCE_INDEX_BUCKET = "transito-8f50c.appspot.com"
export const ROUTE_DISTANCE_INDEX_PATH = "route-distances/v1.json.gz"

export const ROUTE_DISTANCE_INDEX_PUBLISH_TIMEOUT_MS = 30_000

export type TRouteDistanceIndexPublishResult = "uploaded" | "unchanged" | "skipped" | "failed"

/**
 * Builds the route distance index from the generated bus services and uploads it to Firebase
 * Storage. Best effort: failures and timeouts are logged and the previous object stays in place.
 */
export async function publishRouteDistanceIndex(
	busServices: TBusServiceJSON,
): Promise<TRouteDistanceIndexPublishResult> {
	let timer: NodeJS.Timeout | undefined
	const timeout = new Promise<"failed">((resolve) => {
		timer = setTimeout(() => {
			console.warn(
				`⚠️ Route distance index publish timed out after ${ROUTE_DISTANCE_INDEX_PUBLISH_TIMEOUT_MS / 1000}s, keeping the previous index`,
			)
			resolve("failed")
		}, ROUTE_DISTANCE_INDEX_PUBLISH_TIMEOUT_MS)
	})

	try {
		return await Promise.race([tryPublishRouteDistanceIndex(busServices), timeout])
	} finally {
		clearTimeout(timer)
	}
}

async function tryPublishRouteDistanceIndex(
	busServices: TBusServiceJSON,
): Promise<TRouteDistanceIndexPublishResult> {
	try {
		if (!(await canUploadToStorage())) {
			return "skipped"
		}

		const encoded = encodeRouteDistanceIndex(buildRouteDistanceIndex(busServices.data))
		const result = await uploadRouteDistanceIndex(encoded, busServices.metadata)

		console.log(
			result === "uploaded"
				? `🗺️ Route distance index uploaded (${encoded.gzip.length} bytes)`
				: "🗺️ Route distance index unchanged, skipping upload",
		)
		return result
	} catch (error) {
		console.error("❌ Error publishing route distance index:", error)
		return "failed"
	}
}

export function shouldUploadRouteDistanceIndex(
	existingContentHash: unknown,
	contentHash: string,
) {
	return existingContentHash !== contentHash
}

async function uploadRouteDistanceIndex(
	encoded: TEncodedRouteDistanceIndex,
	generatedAt: string,
): Promise<"uploaded" | "unchanged"> {
	const file = getStorage(getFirebaseApp()).bucket().file(ROUTE_DISTANCE_INDEX_PATH)
	const [exists] = await file.exists()
	const existingContentHash = exists ? (await file.getMetadata())[0].metadata?.contentHash : undefined

	// Devices re-download whenever the object changes, so never rewrite identical content.
	if (!shouldUploadRouteDistanceIndex(existingContentHash, encoded.contentHash)) {
		return "unchanged"
	}

	await file.save(encoded.gzip, {
		resumable: false,
		timeout: ROUTE_DISTANCE_INDEX_PUBLISH_TIMEOUT_MS,
		contentType: "application/gzip",
		metadata: {
			metadata: {
				contentHash: encoded.contentHash,
				generatedAt,
			},
		},
	})

	return "uploaded"
}

function getFirebaseApp() {
	return (
		getApps()[0] ??
		initializeApp({
			credential: applicationDefault(),
			storageBucket: ROUTE_DISTANCE_INDEX_BUCKET,
		})
	)
}

async function canUploadToStorage() {
	if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
		return true
	}

	// Keep local runs away from the production bucket unless they target the emulator.
	if (process.env.ENV === "dev") {
		console.warn(
			"⚠️ Skipping route distance index upload: set FIREBASE_STORAGE_EMULATOR_HOST to upload in dev",
		)
		return false
	}

	try {
		await applicationDefault().getAccessToken()
		return true
	} catch {
		console.warn(
			"⚠️ Skipping route distance index upload: no Google application default credentials found",
		)
		return false
	}
}
