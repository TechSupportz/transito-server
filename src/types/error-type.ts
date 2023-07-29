export interface ZodRouterErrorPayload {
	code: string
	message: string
}

export interface ZodRouterError {
	body?: ZodRouterErrorPayload[]
	headers?: ZodRouterErrorPayload[]
	params?: ZodRouterErrorPayload[]
	query?: ZodRouterErrorPayload[]
	files?: ZodRouterErrorPayload[]
}