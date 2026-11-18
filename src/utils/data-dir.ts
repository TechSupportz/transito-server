import path from "path"

/** The persistent data volume (`/app/data` in the container), overridable with `DATA_DIR`. */
export function getDataDir() {
	return process.env.DATA_DIR || path.join(__dirname, "../../data")
}

/** The last complete Static Catalogue, kept so it survives restarts and new images. */
export function getStaticCataloguePath() {
	return path.join(getDataDir(), "static-catalogue.json")
}
