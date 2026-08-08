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

Note that (a) is only constructible on today's build: nothing yet stops two virtual devices claiming
the same meter. After the fix it is refused at persistence — see §4 — which is why the acceptance
criteria below test the split with one claimant per channel, and the double claim as a rejection.

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
of an already-claimed energy property should therefore be refused, and the wizard should report it as
an incompatible pairing rather than a silent surprise.

**What counts as an energy claim is decided by the destination slot, not by the source.** The
ingestion classifies whatever property it is handed by *that property's own* channel:
`findSourceType(channel.category, property.category)` at `energy-ingestion.listener.ts:123`, where
`channel` is the channel the ingested property hangs on. `wasIngestedAsSource()` looks at the
source's channel instead, and that asymmetry is deliberate — it is what lets a `consumption` property
sitting in a `generic` channel be projected into an `electrical_energy` channel and finally be
counted, the "missing meter" case. It also means a claim keyed on "is the *source* energy-bearing"
misses exactly that shape: two virtual properties projecting one non-qualifying source both ingest
today, and the household total doubles. So a projection is energy-bearing when its **own** channel
and property categories map to a source type, and the claim's uniqueness key is the underlying source
property id. The rejection tests must cover a non-qualifying source claimed twice, not only a
qualifying one.

The check has to be **atomic**, not a read-then-write. Two creates or remaps claiming the same
previously unclaimed meter can both pass an `assertProjectionCompatible`-style read and both persist,
which recreates precisely the ambiguity the rule exists to remove. Two mechanisms are available and
the task should pick deliberately:

- `DeviceStructureLockService`, which already serialises exactly these writes — `beforeCreate` and
  `beforeUpdate` on channel properties run inside it — so the check and the insert cannot interleave.
  Complete for this deployment, and process-local by nature.
- A **database-enforced claim**, which is the durable answer. Note that a partial unique index on
  `sourcePropertyId` cannot express it: whether a projection is energy-bearing depends on its *own*
  channel's category, and the projection row carries only a channel id — the category is a join away,
  which a partial index cannot reach. A small claims table keyed by source property id, written when a
  projection whose destination slot is energy-bearing is created and deleted with it, can carry a real
  unique constraint. The same rule decides what the migration below writes.

Taking both is defensible — the lock removes the window, the constraint makes it impossible — and a
concurrent-claim regression test is required either way.

**Claims that already exist.** The guard above only governs future writes. An installation upgrading
from today's build can already hold two virtual devices claiming one meter (§2 is exactly that
scenario), and validating new persistence leaves those rows untouched, so attribution would still
have no unique claimant. That needs deciding before the fix ships, and deleting somebody's projection
is data loss, so the recommended shape is:

- an **incremental migration** (never a change to the initial one) that materialises the claim for
  every existing energy projection, awarding it deterministically — oldest `createdAt`, ties broken by
  id — so attribution is unambiguous from the first boot after upgrade;
- the losers keep working as *readings*; only the energy claim moves, and a startup reconciliation
  logs them once, loudly enough that an operator can rebuild the device if the automatic choice was
  not what they meant.

**The delta baseline stays keyed to the physical meter.** `DeltaComputationService.computeDelta()`
keys its baseline `${deviceId}:${channelId}:${sourceType}`
(`delta-computation.service.ts:65`) and answers `null` for a key it has not seen. If the `deviceId`
handed to it changes when attribution moves to the virtual device, then the first reading after a
projection is created — and again after a claim is removed or remapped — has no baseline, and the
consumption accumulated since the previous sample is silently dropped. Computation must therefore go
on identifying the meter by its physical device and channel, with only the *persisted* attribution
taking the virtual identity. The test for this is a transition — readings before the projection, the
projection, readings after — not two readings taken once it already exists.

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
- [ ] **The split case, with one claimant per meter:** two energy-bearing channels of one physical
      device — a 4PM has one per relay — projected into different rooms put each channel's kWh in its
      own room, nothing in the other, and leave the house total unchanged
- [ ] A second projection of an already-claimed energy property is refused at persistence, and the
      wizard reports the pairing as incompatible
- [ ] Two concurrent claims on the same previously unclaimed meter cannot both persist — with a
      regression test that drives them concurrently, not one after the other
- [ ] A **non-qualifying** source (a `consumption` property in a `generic` channel) projected into two
      `electrical_energy` slots is refused the same way, and the household total does not double
- [ ] Creating a projection over an already-running meter loses no consumption: a transition test with
      readings before and after the projection shows the delta spanning them, not a dropped first
      sample
- [ ] An installation that already holds duplicate claims comes up with exactly one claimant per
      meter after the migration, deterministically chosen, with the others left working as readings
      and reported once at startup
- [ ] An orphaned projection is attributed to the virtual device that holds it — there is no source
      left to fall back to. `VirtualValueSourceService.resolve()` answers `null` once
      `sourcePropertyId` is null, the registry then resolves the property to its own id, and
      `wasIngestedAsSource()` reads that as "not a projection" and ingests it. That is already the
      behaviour; the criterion is that the fix does not change it, and that an orphan therefore stops
      accruing rather than accruing in the wrong room, since no value reaches it once its meter is
      gone
- [ ] Regression tests for the split case above and for the refusal — **not** for reproduction (a) as
      it stands: it projects one meter into two rooms, which the single-claim rule makes impossible to
      construct, and a test that bypassed persistence to build it would be asserting a split this task
      never defines the rule for (why room A rather than room B owns the delta). Reproduction (a) is
      evidence of today's behaviour, and the fix's job is to make its *shape* unbuildable

## 6. Notes

`docs/superpowers/specs/2026-07-31-virtual-devices-design.md` describes the guard as skipping
projections "wholesale" and lists per-channel energy attribution as a pre-existing limitation. The
first is out of date against the code, and the second understates this: the zero-in-every-room
outcome is introduced by the split, not inherited. Worth correcting there when this is fixed.
