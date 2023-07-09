import { z } from "zod"

export const zodFetch = async <T>(
	url: string,
	options: RequestInit = {},
	schema: z.Schema<T>,
): Promise<T> => {
	const res = await fetch(url, options)

	if (!res.ok) throw res.statusText

	const parsedRes = res.json().then((data) => schema.parseAsync(data))

	return parsedRes
}
