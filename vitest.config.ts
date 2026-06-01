import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
	test: {
		environment: "node",
	},
	resolve: {
		alias: {
			"@fetchers": path.resolve(__dirname, "src/fetchers"),
			"@json": path.resolve(__dirname, "src/json/index"),
			"@routes": path.resolve(__dirname, "src/routes"),
			"@app-types": path.resolve(__dirname, "src/types"),
			"@utils": path.resolve(__dirname, "src/utils"),
		},
	},
})
