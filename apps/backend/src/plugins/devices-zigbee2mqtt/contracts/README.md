# Zigbee source contracts

Control freshness requires a current bridge device registry with a verified IEEE address and a matching exposed measurement contract. The internal source table binds these facts, the literal unit, and the canonical property mapping to the existing device/property UUIDs. Labels, descriptions, vendor metadata, and complete gateway configuration are not persisted.

A newly created device can establish its baseline during adoption. Existing rows without a baseline remain available for ordinary display and legacy commands, but cannot supply qualified control evidence or strict composite targets. An operator must use the existing adoption workflow to confirm a compatible mapping; friendly names never establish historical physical identity automatically.

IEEE reassignment, a changed exposed unit/measurement contract, or an omitted confirmed mapping quarantines the durable baseline. Restarting the backend or restoring metadata does not clear quarantine. Compatible deliberate re-adoption preserves property UUIDs and history, then requires a measurement observed after the new binding. A pure physical-device rename preserves the baseline but invalidates the old route until compatible re-adoption confirms the new friendly name.

Bound commands and strict composite batches check the current identity lease again immediately before MQTT publication or WebSocket send. Quarantine refuses dispatch. Truly unbound ordinary commands retain their existing behavior.

Physical identity and transport provenance are separate requirements. Qualified samples also require verified current `advanced.cache_state=false`, an explicitly present field, and a live packet. Retained/cache-merged startup state never renews control freshness. WebSocket frames additionally require a trustworthy post-connection measurement timestamp. This implementation does not change gateway configuration or infer hardware qualification from brand/model metadata.
