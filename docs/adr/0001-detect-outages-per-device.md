# ADR-0001: Detect Outages per device, store only Announcements on the server

- Status: Accepted
- Date: 2026-09-23

## Context

Users should learn when LTA, NUS, or Transito's server is unavailable, and the operator needs a way
to publish arbitrary messages. LTA is called directly by the app; NUS is relayed through the server.

## Decision

- Each app detects Outages from the outcome of requests it already makes and clears them on the next
  success. Outages are never reported to, stored by, or shared through the server.
- The server stores only operator-authored Announcements and serves the currently active ones.
- The server reports upstream NUS failures (including malformed upstream responses) distinctly from
  its own failures, so the app does not mistake a NUS Outage for a server Outage.
- Timeouts never count as an Outage, and network failures only count as a server Outage when another
  dependency succeeded recently; otherwise the device is treated as Offline.

## Alternatives considered

- Server-side NUS status tracking from relayed requests. Rejected: NUS Outages should only be shown to
  users whose own requests hit NUS, and those users already learn of the failure from their own
  request, so shared state added thresholds and freshness windows for no new information.
- Apps reporting Outages to the server for propagation. Rejected: provider outages are global, so each
  device notices within one request anyway.

## Consequences

- A hung server that accepts connections but never responds is not detected automatically; the
  operator escalates with a critical Announcement.
