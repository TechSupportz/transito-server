export const NUS_SERVICE_CODES = ["A1", "A2", "D1", "D2", "K", "R1", "R2", "P"]

export const NUS_TO_LTA_BUS_STOP_MAPPINGS: Record<string, string> = {
	CLB: "16181",
	IT: "16189",
	MUSEUM: "16161",
	RAFFLES: "16169",
	YIH: "16171",
	"YIH-OPP": "16179",
	UHC: "18329",
	"UHC-OPP": "18321",
	UHALL: "18319",
	"UHALL-OPP": "18319",
	"KR-MRT": "18331",
	"KR-MRT-OPP": "18339",
	KRB: "16009",
	"JP-SCH-16151": "16151",
	LT27: "18301",
	SDE3: "16149",
	"SDE3-OPP": "16141",
	CG: "41029",
	EA: "16159",
}

export function normalizeNUSPickupPointCode(code: string, routeCode: string) {
	const markerSuffixPattern = new RegExp(`-${routeCode}-(S|E)$`, "i")
	return code.replace(markerSuffixPattern, "")
}
