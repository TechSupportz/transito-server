import type { TBusRouteStop } from "@app-types/bus-route-type"

type TStop = [nusCode: string, latitude: number, longitude: number]

const schedule = { weekdays: "", saturday: "", sunday: "" }

function makeRoute(stops: TStop[]): TBusRouteStop[] {
	return stops.map(([nusCode, latitude, longitude], index) => ({
		busStop: {
			code: nusCode,
			name: nusCode,
			roadName: "",
			latitude,
			longitude,
			sources: { NUS: nusCode },
		},
		direction: 1,
		sequence: index + 1,
		distance: 0,
		firstBus: schedule,
		lastBus: schedule,
	}))
}

export const UHALL_OPP = { latitude: 1.29752638901257, longitude: 103.77813111102236 }

// Midpoint of LT27 -> UHALL-OPP, on the stretch to K's first visit to UHALL-OPP
export const APPROACHING_FIRST_UHALL_OPP = {
	latitude: 1.29745580197259,
	longitude: 103.77952904834838,
}

// Midpoint of UHC -> UHALL-OPP, on the stretch to K's second visit to UHALL-OPP
export const APPROACHING_SECOND_UHALL_OPP = {
	latitude: 1.29822541650569,
	longitude: 103.77712263901746,
}

// Coordinates from the Static Catalogue, 2026-10-31. UHALL-OPP is visited at indices 3 and 12.
export const K_ROUTE = makeRoute([
	["PGP", 1.291765, 103.780419],
	["KR-MRT", 1.29485266612069, 103.78437805999793],
	["LT27", 1.29738521493261, 103.7809269856724],
	["UHALL-OPP", UHALL_OPP.latitude, UHALL_OPP.longitude],
	["UHC-OPP", 1.29879333297449, 103.77561916702605],
	["YIH", 1.29890150201437, 103.77438231319462],
	["CLB", 1.29656572408064, 103.77254247664239],
	["SDE3-OPP", 1.29786833526113, 103.76959523650599],
	["JP-SCH-16151", 1.30076138899694, 103.76993555602371],
	["KV", 1.301816, 103.769533],
	["MUSEUM", 1.30107500001488, 103.77369416698464],
	["UHC", 1.2989244439988, 103.77611416701255],
	["UHALL-OPP", UHALL_OPP.latitude, UHALL_OPP.longitude],
	["S17", 1.29752011664987, 103.78134198615086],
	["KR-MRT-OPP", 1.29506450651125, 103.78455508578391],
	["PGPR", 1.290969, 103.78109],
])

// A loop: KRB is the origin and the ending terminal.
export const A1_ROUTE = makeRoute([
	["KRB", 1.29425341056334, 103.76988323197696],
	["LT13", 1.294552, 103.770635],
	["AS5", 1.293619, 103.771475],
	["BIZ2", 1.293223, 103.775068],
	["TCOMS-OPP", 1.293789, 103.776715],
	["PGP", 1.291765, 103.780419],
	["KR-MRT", 1.29485266612069, 103.78437805999793],
	["LT27", 1.29738521493261, 103.7809269856724],
	["UHALL-OPP", UHALL_OPP.latitude, UHALL_OPP.longitude],
	["UHC-OPP", 1.29879333297449, 103.77561916702605],
	["YIH", 1.29890150201437, 103.77438231319462],
	["CLB", 1.29656572408064, 103.77254247664239],
	["KRB", 1.29425341056334, 103.76988323197696],
])
