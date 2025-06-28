export interface IZodRouterErrorPayload {
	code: string
	message: string
}

export interface IZodRouterError {
	body?: IZodRouterErrorPayload[]
	headers?: IZodRouterErrorPayload[]
	params?: IZodRouterErrorPayload[]
	query?: IZodRouterErrorPayload[]
	files?: IZodRouterErrorPayload[]
}
