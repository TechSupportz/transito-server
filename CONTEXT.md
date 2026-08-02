# Transito

Transito presents public transport stops and services from multiple transport data providers as one searchable transit model.

## Language

**Bus Stop**:
A physical boarding point where one or more bus services may stop.
_Avoid_: Provider stop, LTA stop, NUS stop

**Search Vocabulary**:
Alternative labels that help users find a bus stop without changing its canonical name.
_Avoid_: Display name, source name

**Road Name**:
The road associated with a bus stop when the provider supplies one.
_Avoid_: Campus label

**Stop Overlap**:
Two provider sources that refer to the same physical boarding point.
_Avoid_: Duplicate stop

**Provider Source**:
A transport data provider's identity for a bus stop or service.
_Avoid_: Provider, owner

**Bus Service**:
A provider-neutral bus route offering that users can search for and inspect.
_Avoid_: LTA service, NUS service

**Service Catalogue Entry**:
A curated service included in the static catalogue.
_Avoid_: Discovered service

**Static Catalogue**:
The generated set of bus stops, services, and routes used for search and lookup.
_Avoid_: Live arrivals

**Service Route**:
The ordered stop pattern followed by a bus service.
_Avoid_: ETA route, arrival route

**Bus Stop Service Interchange**:
A stop-specific view of a bus service that identifies the service route serving that bus stop.
_Avoid_: Arrival route, service chip data

**Route Operating Window**:
The first and last service times that apply to a service route.
_Avoid_: Per-stop schedule

**Route Distance**:
The provider-supplied cumulative distance for a stop within a service route.
_Avoid_: Estimated distance

**Route Marker**:
A route-specific pickup point identifier that marks a position in a service route but is not a separate bus stop.
_Avoid_: Bus Stop, Provider Source

**Bus Arrival**:
A live prediction for upcoming buses serving a stop.
_Avoid_: Static route data

**Arrival Enrichment**:
Additional live or static context attached to a bus arrival when it can be resolved.
_Avoid_: Required arrival data

## Relationships

- A **Bus Stop** has one or more **Provider Sources**, keyed by transport data provider.
- A **Provider Source** belongs to exactly one transport data provider.
- A **Stop Overlap** is a curated domain decision, not just a geographic proximity match.
- A **Bus Stop** uses the LTA provider source as its canonical identity when one exists; otherwise it uses the NUS provider source.
- A **Bus Stop** may include source-specific names in its **Search Vocabulary**.
- A **Bus Stop** may include provider source codes in its **Search Vocabulary**.
- A **Bus Stop** may have no **Road Name** when the provider does not supply one.
- A **Bus Stop** lists all bus services that serve it, regardless of transport data provider.
- A **Bus Stop** may have more than one **Bus Stop Service Interchange** for the same **Bus Service** when multiple **Service Routes** serve it.
- The **Static Catalogue** is generated as one coherent dataset across transport data providers.
- A partial **Static Catalogue** should not replace the previous complete catalogue.
- A **Bus Service** may originate from any transport data provider, but remains the same kind of concept to users.
- A **Bus Service** from NUS is included as a **Service Catalogue Entry** rather than by open-ended discovery.
- A **Bus Service** identifies its transport operator in the same way regardless of transport data provider.
- A **Bus Service** has one or more **Service Routes**.
- A **Service Route** has a **Route Operating Window** that may be shown on each stop in that route.
- A **Service Route** may have unknown **Route Distance** when the provider does not supply one.
- A **Service Route** may contain **Route Markers** that resolve to real **Bus Stops**.
- A **Bus Arrival** is live operational data, not part of the static service catalogue.
- A **Bus Arrival** may have **Arrival Enrichment**, but remains valid without it.

## Example dialogue

> **Dev:** "If LTA and NUS both know about the same boarding point, do we show two bus stops?"
> **Domain expert:** "No — it is one **Bus Stop** with two **Provider Sources**."
> **Dev:** "Should NUS shuttle routes use a different response model from LTA services?"
> **Domain expert:** "No — users see them as **Bus Services**."
> **Dev:** "Do live arrival predictions depend on the static service catalogue?"
> **Domain expert:** "No — **Bus Arrivals** are a separate live view."
> **Dev:** "If vehicle telemetry cannot be matched to an arrival, do we drop the arrival?"
> **Domain expert:** "No — keep the **Bus Arrival** and omit the unavailable **Arrival Enrichment**."

## Flagged ambiguities

- "provider" was used to mean both the source organization and a stop-level owner — resolved: use **Provider Source** for provider-specific identities, because a **Bus Stop** can be known by more than one provider.
- "route" was used for both static stop patterns and live arrival lookups — resolved: use **Service Route** for the static pattern and **Bus Arrival** for live predictions.
