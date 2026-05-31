import { writeFile } from "fs/promises"
import path from "path"

export async function writeJSON(fileName: string, data: Object) {
	await writeFile(path.join(__dirname, `../json/${fileName.trim()}.json`), JSON.stringify(data))
	console.log(`📄 ${fileName} JSON file generated`)
}
