import { writeFile } from "fs"
import path from "path"

export async function writeJSON(fileName: string, data: Object) {
	writeFile(path.join(__dirname, `../json/${fileName.trim()}.json`), JSON.stringify(data), (err) => {
		if (err) {
			console.error(`❌ Error writing ${fileName} file`, err)
			Promise.reject(err)
			throw err
		} else {
			console.log(`📄 ${fileName} JSON file generated`)
			Promise.resolve()
		}
	})
}
