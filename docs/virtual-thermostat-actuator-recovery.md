# Restore a thermostat actuator after discovery loss

The thermostat reserves each heating or cooling switch by its device, channel and property IDs. An integration can supply a stable hardware identity. Shelly Gen2 uses its canonical MAC and switch component, so rediscovery under a new property ID can identify the same physical output. The claim survives disconnection and discovery loss. It remains reserved until the runtime proves OFF and accounts for pending ON commands.

An owner or administrator signed in as a user can restore the **same physical switch** through `POST producers/thermostats/:controllerId/claims/:claimId/restore` in the devices-virtual plugin API. Read `GET producers/thermostats/:controllerId` and copy the configuration revision, claim ID, claim revision and `physical_identity`. Confirm the previous endpoint was disconnected or lost. Select a rediscovered property with the same identity. For an integration that uses catalog IDs, all three IDs must match. Use the same property UUID whenever the old property row still exists. This example uses a Shelly switch with a hardware identity.

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

Restoration keeps the claim and physical reservation, records the authenticated actor and reason in `GET producers/thermostats/:controllerId/recoveries`, forces the requested mode to OFF, revokes in-flight command authority and rotates the claim's `qualification_generation`. The restore acknowledgement records what the operator observed about connectivity. The runtime obtains fresh physical OFF evidence for the restored endpoint.

If release was already requested, restoration preserves that demand and its timestamps and returns the restored claim to `releasing`. The runtime still requires fresh qualification and ordered OFF/drain proof before releasing the reservation.

For a software-supervised switch, acknowledge independent protection for the restored endpoint before requesting heat or cooling. When a device safety extension is selected, use its commissioning workflow to verify the device identity, firmware, writer isolation and independent protection for the new qualification generation. Wait for the runtime to show fresh `release_proven` before setting the desired mode. A restart requires fresh runtime reconciliation.

Permanently lost equipment stays reserved. Restoration requires the original identity and physical OFF proof.
