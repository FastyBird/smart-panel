# Restore a thermostat actuator after discovery loss

The thermostat keeps a physical switch reserved by its canonical Shelly MAC and switch ID even when its database property disappears or the device disconnects. This prevents another writer from taking a heater whose previous ON command has uncertain execution. A release request does not free that reservation until the runtime proves an ordered OFF and drains pending ON.

An owner or administrator signed in as a user can restore the **same physical switch** to that claim. The restore route is `POST producers/thermostats/:controllerId/claims/:claimId/restore` under the devices-virtual plugin API. Long-lived API tokens and ordinary users cannot invoke it. Inspect `GET producers/thermostats/:controllerId` first and copy the configuration revision, claim ID, claim revision and `physical_identity`. Confirm the old endpoint was disconnected or lost and rediscover the same physical relay. Its `source_property` must resolve to the same canonical MAC and switch ID. If the old property row still exists, use that same property UUID; changing to a different property UUID while the old alias remains would leave the alias insufficiently reserved. Then submit:

```json
{
  "expected_revision": 4,
  "expected_claim_revision": 7,
  "physical_identity": "shelly-ng:A8032ABE5084:switch:0:output",
  "source_property": "REPLACE-WITH-DISCOVERED-PROPERTY-UUID",
  "disconnection_acknowledged": true,
  "reason": "Re-adopted the same relay after database discovery was restored"
}
```

The revisions and identity above are examples; use the values returned for the actual installation. The operation keeps the same claim and canonical reservation, records the authenticated actor and reason in `GET producers/thermostats/:controllerId/recoveries`, forces requested mode OFF, revokes in-flight command authority, and rotates the claim's durable `qualification_generation`. The old installation profile cannot qualify the restored claim, including after a backend restart. The acknowledgement is an operator statement about connectivity. It does **not** assert output OFF, drain pending ON, qualify the new endpoint, or release the old hardware.

If release was already requested, restoration preserves that demand and its timestamps and returns the restored claim to `releasing`. The runtime still requires fresh qualification and ordered OFF/drain proof before releasing the reservation.

Before requesting heat or cool again, commission and install new hardware qualification for this exact endpoint and `qualification_generation` through the protected qualification workflow. Verify actual device identity, firmware, writer isolation, independent protection and ordered OFF/drainage behavior. Wait for runtime to show fresh `release_proven` from that qualified provider, then set the desired mode through the normal revision-fenced thermostat configuration flow. A restart requires fresh runtime reconciliation again.

Restoring a different MAC or switch component is refused. Permanently lost equipment stays reserved; this API does not retire it or permit replacement by an unrelated relay. A separate design is needed for explicit physical decommissioning that can retain the old canonical tombstone while introducing a new branch without claiming a false OFF/drain proof.
