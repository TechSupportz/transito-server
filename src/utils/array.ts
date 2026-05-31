export function appendUniqueValues<T>(values: T[], nextValues: T[]) {
	for (const nextValue of nextValues) {
		if (nextValue && !values.includes(nextValue)) {
			values.push(nextValue)
		}
	}
}
