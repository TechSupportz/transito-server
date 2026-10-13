# ADR-0003: Build Route Shapes from LTA's KML files, with OneMap as the fallback

- Status: Accepted
- Date: 2026-10-13

## Context

The app wants to draw a Bus Service's route on a map, which needs each Service Route's Route Shape:
the path along the roads, not straight lines between stops. LTA DataMall has no route geometry; its
BusRoutes API returns only stop sequences. Two government sources do have it, both undocumented:

- LTA's bus map page serves one KML file per service direction at
  `https://www.lta.gov.sg/map/busService/bus_route_kml/{serviceNo}-{direction}.kml`, listed in
  `https://www.lta.gov.sg/map/busService/bus_services.xml`. The `-1`/`-2` suffix matches DataMall's
  `Direction`; loop services have only `-1`.
- OneMap's bus explorer calls a private endpoint,
  `https://www.onemap.gov.sg/omapi/om/api/private/busexp/getBusRoutes?busNo={serviceNo}`, that
  returns stop-to-stop segments as encoded polylines. It answers 403 without the explorer's
  `Referer`.

A survey of every KML in October 2026 found that the files cannot be used as they are:

- 105 of about 800 directions have several LineStrings, and 50 of those are stored out of order
  (`12-1` jumps 13 km in file order). After joining, 20 still have a gap over 300 m.
- 7 directions are drawn from the last stop to the first (`12-2`).
- In most directions every stop is within 150 m of the line, but 5 short-working variants are drawn
  as a different route, with a stop up to 8 km away (`2B-1`). Terminal and depot stops set back from
  the road sit up to about 470 m away.
- LTA's firewall answers 403 to an IP that sends about a hundred requests in a burst, and keeps
  blocking it for a while.

OneMap's stop sequence matches DataMall exactly for about 78% of directions, including most of the
broken KMLs; the rest differ because OneMap lags route changes.

## Decision

- During `generateJSON`, after the Static Catalogue is built, the server builds an encoded polyline
  (precision 5) for every Service Route and stores it in `bus-services.json` as `routePolylines`,
  one entry per route in the same order as `routes`, `null` when unknown.
  `GET /bus-service/:serviceNo?includeRoutes` returns it next to `routes`; without `includeRoutes`
  neither is sent.
- For an LTA direction, the server tries, in order:
  1. **LTA KML.** Fetch the service list, then each listed file one at a time, 500 ms apart, with a
     10 s timeout and one retry. Join LineStrings from the endpoint nearest the first stop, always
     attaching the nearest piece and reversing pieces as needed; this also turns a backwards line
     round. Reject the line if any stop is more than 500 m from it; mark it suspect between 300 and
     500 m. A gap over 300 m after joining sends the direction to the fallback. After the first
     403, request no more KMLs in that run.
  2. **OneMap**, one service at a time, 200 ms apart, accepted only when its stop sequence matches
     DataMall's exactly; its segments are joined in order.
  3. **A gappy KML**, marked suspect, when OneMap cannot help.
  4. **The previous catalogue's polyline**, only when the direction's stop codes are unchanged.
  5. Otherwise `null`.
- An NUS direction uses the NUS checkpoint path that `generateJSON` already fetches for Route
  Distances, with the same 500 m stop check, then falls back to steps 4 and 5.
- Every line is simplified with Douglas–Peucker at about 5 m (`simplify-js`) and encoded with
  `@mapbox/polyline`. All polylines together add about 400 KB to the catalogue.
- Route Shapes are optional data: no failure in building them fails `generateJSON`.
- Fetching every KML at that pace takes about 7.5 minutes, past Cloudflare's 125 s proxy timeout in
  front of the server, so `POST /generate-json` replies 202 and runs in the background (409 while a
  run is going). Each run's status and `summary` (how each direction got its shape and why) is saved
  on the data volume, so it survives the restart after a successful run, and served by
  `GET /generate-json/last-run`. The refresh worker polls it every minute, for up to 14 of its 15
  minutes, and sends the summary to the operator on Telegram, or a warning if no result arrives.
- Route Shapes stay out of the Route Distance Index (ADR-0002), which every device downloads at
  launch; only the screen that draws a route needs them.

## Alternatives considered

- OneMap as the primary source. Rejected: it is a private endpoint we can only reach by presenting
  its own page as the referrer, so it is kept to the directions LTA's files cannot serve.
- Straight lines between stops as the fallback. Rejected: they look like a route but are not one,
  and the app can draw them from the stops itself.
- A DNS-only hostname for `/generate-json` to avoid the proxy timeout. Rejected: it exposes the VM
  directly and needs DNS and TLS changes, while a 202 plus polling needs neither.
- The server sending the Telegram report itself. Rejected: it would move the bot token onto the
  server, and a run that dies would send nothing; the polling worker reports that too.
- A separate endpoint or file for polylines. Rejected: storing them next to `routes` keeps both from
  the same run, and the payload grows only for `includeRoutes` requests.

## Consequences

- Both sources are undocumented and can change or disappear without notice. The Telegram report
  shows the KML, OneMap, reused and missing counts every week, so a source breaking shows up as a
  shift between them, and reuse keeps last week's shapes while stops are unchanged.
- Pacing LTA requests makes `generateJSON` take about 7.5 minutes instead of about 10 seconds; if it
  ever nears the worker's 14-minute polling window, the report says so and the run still completes.
- Thresholds are constants in `src/utils/route-shapes.ts`, set from the survey; retune them from
  the weekly report.
