import Router from "@koa/router"
import { TRouteBuilderSpec, TRouteValidationSchema } from "@app-types/route-builder-type"
import z from "zod"
import { DefaultContext } from "koa"

export const defineRoute = <
	B extends z.ZodRawShape = any,
	Q extends z.ZodRawShape = any,
	P extends z.ZodRawShape = any,
	H extends z.ZodRawShape = any,
>(
	spec: TRouteBuilderSpec<B, Q, P, H>,
) => spec

export const validateRoute = <
	B extends z.ZodRawShape = any,
	Q extends z.ZodRawShape = any,
	P extends z.ZodRawShape = any,
	H extends z.ZodRawShape = any,
>(
	schema: TRouteValidationSchema<B, Q, P, H>,
) => {
	return async (ctx: DefaultContext, next: () => Promise<any>) => {
		try {
			if (schema.body) {
				ctx.request.body = schema.body.parse(ctx.request.body)
			}
			if (schema.query) {
				ctx.request.query = schema.query.parse(ctx.request.query)
			}
			if (schema.params) {
				ctx.params = schema.params.parse(ctx.params)
			}
			if (schema.headers) {
				ctx.request.headers = schema.headers.parse(ctx.request.headers)
			}
			await next()
		} catch (err) {
			if (err instanceof z.ZodError) {
				ctx.status = 422
				ctx.body = {
					message: `Validation Error: ${err.message}`,
					errors: err.issues,
				}
			}
		}
	}
}

export const buildRoute = <
	B extends z.ZodRawShape = any,
	Q extends z.ZodRawShape = any,
	P extends z.ZodRawShape = any,
	H extends z.ZodRawShape = any,
>(
	router: Router,
	spec: TRouteBuilderSpec<B, Q, P, H>,
) => {
	const { method, path, validate, handler } = spec
	const routeMiddlewares = []

	if (validate) {
		routeMiddlewares.push(validateRoute(validate))
	}

	switch (method.toLowerCase()) {
		case "get":
			router.get(path, ...routeMiddlewares, handler)
			break
		case "post":
			router.post(path, ...routeMiddlewares, handler)
			break
		case "put":
			router.put(path, ...routeMiddlewares, handler)
			break
		case "delete":
			router.delete(path, ...routeMiddlewares, handler)
			break
		case "patch":
			router.patch(path, ...routeMiddlewares, handler)
			break
		default:
			throw new Error(`Unsupported HTTP method: ${method}`)
	}
}
