# Zigbee source contracts

Control freshness requires a current bridge device registry with a verified IEEE address and a matching exposed measurement contract. The internal source table binds these facts, the literal unit, and the canonical property mapping to the existing device/property UUIDs. Labels, descriptions, vendor metadata, and complete gateway configuration are not persisted.

A newly created device can establish its baseline during adoption. Existing rows without a baseline remain available for ordinary display and legacy commands, but cannot supply qualified control evidence or strict composite targets. An operator must use the existing adoption workflow to confirm a compatible mapping; friendly names never establish historical physical identity automatically.

IEEE reassignment, a changed exposed unit/measurement contract, or an omitted confirmed mapping quarantines the durable baseline. Restarting the backend or restoring metadata does not clear quarantine. Compatible deliberate re-adoption preserves property UUIDs and history, then requires a measurement observed after the new binding. A pure physical-device rename preserves the baseline but invalidates the old route until compatible re-adoption confirms the new friendly name.

Bound commands and strict composite batches check the current identity lease again immediately before MQTT publication or WebSocket send. Quarantine refuses dispatch. Truly unbound ordinary commands retain their existing behavior.

For a bound measurement, MQTT and WebSocket use the same freshness rules. A live report refreshes the fields it carries. With the Zigbee2MQTT default `advanced.cache_state: true`, a battery report can carry the last temperature and refresh it as well. With `advanced.cache_state: false`, Zigbee2MQTT omits those cached fields.

A retained message or startup replay with a usable `last_seen` keeps the device's report time. An untimed replay provides a display value only. A live report without a usable `last_seen` is timed by arrival after the startup replay window. Relay OFF confirmation excludes replays and marked command acknowledgements. The operator controls the gateway configuration. Brand and model metadata alone cannot establish hardware qualification.
