# ADR-0002: Publish the Route Distance Index to Firebase Storage

- Status: Accepted
- Date: 2026-10-08

## Context

The app shows how far a live bus is from a stop. A straight line understates this on winding or
looping routes, so the app needs each Service Route's cumulative Route Distances and stop positions to
measure along the route instead. That data comes from the Static Catalogue, which `generateJSON`
rebuilds weekly, but the whole catalogue is far larger than the app needs.

## Decision

- At the end of each `generateJSON` run, the server builds a compact **Route Distance Index** from
  the generated bus services and uploads it as gzipped JSON to the project's default Firebase Storage
  bucket at `route-distances/v1.json.gz`. The bucket is in the Singapore region, close to every user.
- The app downloads it in the background and never calls Transito's server for it.
- The upload is skipped when the stored object's `contentHash` metadata matches the new index, so
  devices only re-download when routes actually change.
- Publishing is best effort: a failure is logged, `generateJSON` still succeeds, and the previous
  index stays in place.

## Alternatives considered

- A new server endpoint serving the index. Rejected: it would put the server on the app's critical
  path for every launch and add load, while the data only changes weekly.
- Shipping the index in the app bundle. Rejected: routes change between releases.

## Consequences

- `generateJSON` is the only writer, so the index stays in sync with the Static Catalogue.
- The server needs Google credentials that can write to the bucket; without them the index goes
  stale but nothing else breaks.
- If an upload fails its checksum, the Storage SDK deletes the object; apps keep their cached copy,
  fresh installs fall back to straight-line distances, and the next weekly run restores it.
- Changing the index shape needs a new object path (`v2`) so older app versions keep working.
