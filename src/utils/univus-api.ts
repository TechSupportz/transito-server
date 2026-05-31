export const univusPublicBaseUrl = "https://myizaac2.nus.edu.sg/univus-public"
export const univusBaseUrl = "https://myizaac2.nus.edu.sg/univus"

export const univusAPIHeaders: HeadersInit = {
	"Content-Type": "application/json",
	"x-app-api": process.env.UNIVUS_APP_API || "",
	"x-htd-api": process.env.UNIVUS_HTD_API || "",
}
