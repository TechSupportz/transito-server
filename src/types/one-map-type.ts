import { z } from "zod"

export const OneMapTokenResponseSchema = z.object({
	access_token: z.string(),
	expiry_timestamp: z.coerce.number().int().min(0),
})

export type TOneMapTokenResponse = z.infer<typeof OneMapTokenResponseSchema>
