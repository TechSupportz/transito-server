import { HttpMethod, RouterContext } from "@koa/router"
import z from "zod"

export type TRouteValidationSchema<
	B extends z.ZodRawShape = any,
	Q extends z.ZodRawShape = any,
	P extends z.ZodRawShape = any,
	H extends z.ZodRawShape = any,
> = {
	body?: z.ZodObject<B>
	query?: z.ZodObject<Q>
	params?: z.ZodObject<P>
	headers?: z.ZodObject<H>
}

export type TRouteBuilderSpec<
	B extends z.ZodRawShape = any,
	Q extends z.ZodRawShape = any,
	P extends z.ZodRawShape = any,
	H extends z.ZodRawShape = any,
> = {
	method: HttpMethod
	path: string
	validate?: TRouteValidationSchema<B, Q, P, H>
	handler: (
		ctx: RouterContext & {
			request: {
				body: z.infer<z.ZodObject<B>>
				query: z.infer<z.ZodObject<Q>>
				headers: z.infer<z.ZodObject<H>>
			}
			params: z.infer<z.ZodObject<P>>
		},
	) => Promise<void>
}
