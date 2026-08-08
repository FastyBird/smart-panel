# Task: A split device's energy never reaches the rooms it was split into

ID: BUG-ENERGY-VIRTUAL-ROOM-ATTRIBUTION
Type: bug
Scope: backend
Size: medium
Parent: EPIC-VIRTUAL-DEVICES
Status: planned

## 1. Summary

Splitting a multi-channel device into virtual devices moves the *devices* into rooms but not their
energy. Every energy delta is stamped with the room of the device that owned the property the
ingestion actually read — the physical one — so a room containing only virtual devices reports zero
consumption, and a room containing the physical device is billed for channels that are no longer
presented as its own.

This is the epic's own headline example (`EPIC-VIRTUAL-DEVICES` §2: a Shelly 4PM whose four relays
belong to four different rooms), so it is a defect in the feature rather than a limitation of the
energy module. Before virtual devices, a device in no room simply had no room and nobody expected
otherwise; the split is what creates the expectation that is then not met.

## 2. Reproduction

Driving the real `EnergyIngestionListener` and the real `EnergyDataService.getSummary()` against
sqlite, with a source device whose `electrical_energy` channel carries a `consumption` property, and
virtual devices projecting it.

**a) Physical device unassigned, split into two rooms** — two readings, 10 kWh then 12 kWh:

```json
{
  "deltas": [{ "deviceId": "shelly-4pm", "roomId": null, "kwh": 2 }],
  "houseConsumptionKwh": 2,
  "roomAConsumptionKwh": 0,
  "roomBConsumptionKwh": 0
}
```

One delta, stamped with the physical device and no room. Both rooms report zero; the house total is
correct.

**b) Physical device placed in `Utility`, its channel projected into `Kitchen`** — 100 kWh then 105:

```json
{
  "utilityConsumptionKwh": 5,
  "kitchenConsumptionKwh": 0
}
```

The kWh lands where the hardware sits, not where the operator sees the device.

## 3. Cause

Two pieces, both correct on their own:

- `EnergyIngestionListener.processPropertyValue()` stamps each delta with the owning device:
  `const roomId = device.roomId ?? null` (`energy-ingestion.listener.ts:138`), and
  `EnergyDataService.getSummary()` filters `delta.roomId = :roomId` (`energy-data.service.ts:147`).
- `wasIngestedAsSource()` (`energy-ingestion.listener.ts:212`) skips a projection whose *source*
  itself qualifies as an energy source, so the same kWh is not billed twice. Note this is narrower
  than "skips projections wholesale": a projection whose source does not qualify still ingests, which
  is what keeps a meter from going missing.

So double counting is prevented — correctly — and the reading is attributed to the physical device,
which after a split is precisely the device the operator no longer sees.

## 4. Proposed fix

**Attribution follows the projection.** For an energy-bearing channel that a virtual device projects,
stamp the delta with that virtual device's `deviceId` and `roomId`; otherwise with the physical
device's. One delta per real measurement, placed where the device is seen. The physical device's
remaining, unprojected channels keep attributing to it, so a partially split device still adds up.

**Energy slots become single-claim.** The design deliberately lets one source property feed several
virtual devices — "one sensor legitimately serves two rooms' climate" — and that is right for a
*reading*: a temperature is non-additive, so two rooms observing the same value is coherent. Energy
is additive, and two rooms claiming the same kWh is not coherent in any framing. A second projection
of an already-projected energy property should therefore be refused at persistence, with the same
machinery as `assertProjectionCompatible`, and the wizard should report it as an incompatible
pairing rather than a silent surprise.

**History is not re-attributed.** Existing deltas keep the room they were recorded with. Splitting
changes the future only, and the task should say so where an operator can read it, so nobody expects
a backfill.

**An orphan has no source to fall back to.** When the source property is deleted the FK nulls,
`VirtualValueSourceService.resolve()` returns `null`, and the registry resolves the projection to its
own — empty — series. There is no source device left to attribute to, and the virtual index records
none either. Nothing further arrives on that property, so in practice it simply stops accruing; the
fix must not introduce a lookup that assumes otherwise.

## 5. Acceptance criteria

- [ ] A delta for a projected energy property carries the projecting device's `deviceId` and `roomId`
- [ ] A device's unprojected energy channels still attribute to the device itself
- [ ] The same kWh is never counted twice: reproduction (a) yields 2 kWh in room A and 0 elsewhere,
      with the house total still 2 kWh
- [ ] A second projection of an already-projected energy property is refused at persistence, and the
      wizard reports the pairing as incompatible
- [ ] An orphaned projection is attributed to the virtual device that holds it — there is no source
      left to fall back to. `VirtualValueSourceService.resolve()` answers `null` once
      `sourcePropertyId` is null, the registry then resolves the property to its own id, and
      `wasIngestedAsSource()` reads that as "not a projection" and ingests it. That is already the
      behaviour; the criterion is that the fix does not change it, and that an orphan therefore stops
      accruing rather than accruing in the wrong room, since no value reaches it once its meter is
      gone
- [ ] Regression tests carrying both reproductions above

## 6. Notes

`docs/superpowers/specs/2026-07-31-virtual-devices-design.md` describes the guard as skipping
projections "wholesale" and lists per-channel energy attribution as a pre-existing limitation. The
first is out of date against the code, and the second understates this: the zero-in-every-room
outcome is introduced by the split, not inherited. Worth correcting there when this is fixed.
