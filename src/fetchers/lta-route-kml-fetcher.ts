import { XMLParser } from "fast-xml-parser"
import { TLatLng } from "@app-types/route-shape-type"
import { fetchWithRetry } from "@utils/fetch-with-retry"

// Undocumented but long-stable files behind LTA's own bus map page (docs/adr/0003).
export const LTA_BUS_SERVICE_LIST_URL = "https://www.lta.gov.sg/map/busService/bus_services.xml"
export const LTA_ROUTE_KML_BASE_URL = "https://www.lta.gov.sg/map/busService/bus_route_kml"

const FETCH_OPTIONS = { timeoutMs: 10_000, retries: 1 }

const xmlParser = new XMLParser({ ignoreAttributes: true, parseTagValue: false })

export type TLTARouteKMLResult =
	| { status: "ok"; lines: TLatLng[][] }
	| { status: "notFound" }
	| { status: "blocked" }
	| { status: "failed"; reason: string }

/**
 * LTA's firewall answers 403 to an IP that sent too many requests, and keeps doing so for a while.
 * Callers should stop requesting files once they see it rather than prolong the block.
 */
export class LTABlockedError extends Error {
	constructor() {
		super("LTA returned HTTP 403")
		this.name = "LTABlockedError"
	}
}

/** The KML file names LTA lists for its bus services, such as `10-1.kml`. */
export async function fetchLTARouteKMLFileNames(): Promise<Set<string>> {
	const res = await fetchWithRetry(LTA_BUS_SERVICE_LIST_URL, {}, FETCH_OPTIONS)

	if (res.status === 403) {
		throw new LTABlockedError()
	}

	if (!res.ok) {
		throw new Error(`LTA bus service list returned HTTP ${res.status}`)
	}

	const fileNames = new Set<string>()
	collectValues(xmlParser.parse(await res.text()), "kmlFile", (kmlFile) => {
		for (const file of toArray((kmlFile as { file?: unknown } | null)?.file)) {
			if (typeof file === "string") {
				fileNames.add(file.trim())
			}
		}
	})

	return fileNames
}

/** The LineStrings in one service direction's KML file, as [latitude, longitude] points. */
export async function fetchLTARouteKML(fileName: string): Promise<TLTARouteKMLResult> {
	try {
		const res = await fetchWithRetry(
			`${LTA_ROUTE_KML_BASE_URL}/${encodeURIComponent(fileName)}`,
			{},
			FETCH_OPTIONS,
		)

		if (res.status === 404) {
			return { status: "notFound" }
		}

		if (res.status === 403) {
			return { status: "blocked" }
		}

		if (!res.ok) {
			return { status: "failed", reason: `HTTP ${res.status}` }
		}

		const lines = parseKMLLineStrings(await res.text())

		if (lines.length === 0) {
			return { status: "failed", reason: "no LineString in the KML" }
		}

		return { status: "ok", lines }
	} catch (error) {
		return { status: "failed", reason: String(error) }
	}
}

export function parseKMLLineStrings(kml: string): TLatLng[][] {
	const lines: TLatLng[][] = []

	collectValues(xmlParser.parse(kml), "LineString", (lineString) => {
		const coordinates = (lineString as { coordinates?: unknown } | null)?.coordinates

		if (typeof coordinates !== "string") {
			return
		}

		// KML writes "lng,lat[,alt]" tuples separated by whitespace.
		const line = coordinates
			.trim()
			.split(/\s+/)
			.map((tuple) => tuple.split(",").map(Number))
			.filter(([lng, lat]) => Number.isFinite(lat) && Number.isFinite(lng))
			.map(([lng, lat]): TLatLng => [lat, lng])

		if (line.length > 0) {
			lines.push(line)
		}
	})

	return lines
}

function collectValues(node: unknown, key: string, onValue: (value: unknown) => void) {
	if (Array.isArray(node)) {
		node.forEach((child) => collectValues(child, key, onValue))
		return
	}

	if (!node || typeof node !== "object") {
		return
	}

	for (const [childKey, child] of Object.entries(node)) {
		if (childKey === key) {
			toArray(child).forEach(onValue)
		} else {
			collectValues(child, key, onValue)
		}
	}
}

function toArray(value: unknown): unknown[] {
	if (value === undefined) {
		return []
	}

	return Array.isArray(value) ? value : [value]
}
