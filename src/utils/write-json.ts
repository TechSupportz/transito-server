import { writeFile } from "fs"

export const writeJSON = async (fileName: string, data: Object) =>
	writeFile(`./src/json/${fileName.trim()}.json`, JSON.stringify(data), (err) => {
		if (err) {
			console.error(`❌ Error writing ${fileName} file`, err)
			Promise.reject(err)
			throw err
		} else {
			console.log(`📄 ${fileName} JSON file generated`)
			Promise.resolve()
		}
	})
