export const ltaBaseUrl = "http://datamall2.mytransport.sg/ltaodataservice"

export const ltaAPIHeaders: HeadersInit = {
	AccountKey: process.env.LTA_API_KEY ?? "",
	accept: "application/json",
}
