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

- `DeviceStructureLockService`, which serialises the *create* and *update* paths — `beforeCreate` and
  `beforeUpdate` on channel properties run inside it — so a check and an insert cannot interleave.
  Note what it does **not** cover: `ChannelsPropertiesService.remove()` takes no lock
  (`channels.properties.service.ts:556`), so releasing a claim and promoting a successor happens
  outside it entirely. Leaning on the lock alone therefore leaves the delete path racing the create
  path, and it is process-local besides.
- A **database-enforced claim**, which is the durable answer, and the shape matters. A separate claims
  table means two writes — the projection and the claim — and whichever fails second leaves the other
  behind: a rejected create that has already persisted its projection, or a claim with no projection
  under it. Wrapping both in a transaction is the obvious repair and an awkward one here, since the
  backend runs on a single shared SQLite connection and a transaction held across the validation hooks
  collects whatever other requests issue in that window.

  The way out is to stop having two rows. Put the claim **on the projection itself**: a nullable
  column carrying the claimed source property id, set only when this projection's destination slot is
  energy-bearing and the meter is unclaimed, with a unique index over it. It must be a **foreign key
  to the source property with `ON DELETE SET NULL`**, exactly as `sourcePropertyId` is, so the two
  clear together in the one database operation that orphans the projection — no hook runs there. A
  claim left dangling on an orphan would otherwise hold the unique slot against a legitimate
  projection, and worse, a client-supplied id recreating that property would silently hand an
  unrelated meter to the orphan. The invariant is simply that the column is either null or equal to
  `sourcePropertyId`, which is also what makes it cheap to check. Energy-bearing is decided at
  write time, where the destination channel is in hand, so the index never has to reach through a join
  — which is what made a partial index on `sourcePropertyId` unworkable. One insert carries both
  facts, so there is nothing to keep in step, no transaction spanning the hooks, and the constraint
  does the arbitration. Promotion on delete becomes a single conditional `UPDATE`, and the migration
  populates the column.

Taking both is defensible — the lock removes the window, the constraint makes it impossible — and a
concurrent-claim regression test is required either way.

**Claims that already exist.** The guard above only governs future writes. An installation upgrading
from today's build can already hold two virtual devices claiming one meter (§2 is exactly that
scenario), and validating new persistence leaves those rows untouched, so attribution would still
have no unique claimant. That needs deciding before the fix ships, and deleting somebody's projection
is data loss, so the recommended shape is:

- an **incremental migration** (never a change to the initial one) that materialises the claim for
  every existing energy projection, awarding it to the oldest *admissible* candidate — `createdAt`,
  ties broken by id, among those the persistence rules above would accept. A legacy mapping the new
  rules refuse must not be handed a claim just for being oldest: a cross-type projection would keep
  the source's own `EnergySourceType` while presenting another, leaving the room's summary wrong in
  the same way after upgrade as before it. Where no candidate is admissible the meter stays unclaimed
  and attributes to the physical device, which is today's behaviour and at least not misleading;
- the losers keep working as *readings*; only the energy claim moves, and a startup reconciliation
  logs them once, loudly enough that an operator can rebuild the device if the automatic choice was
  not what they meant.

**Exactly one event per meter computes a delta, and the claim decides its attribution.** Every
reading arrives twice — once on the source property, once on each projection of it — so the rule has
to say which single event counts, and the answer differs by whether the *source's own* slot is
recognised:

- **Qualifying source** (`electrical_energy.consumption`, the ordinary meter): the **source event**
  computes the delta, exactly as today, and the claim only changes the `deviceId`/`roomId` stamped on
  it — the claimant's if there is one, its own if there is not. Every projection event is skipped,
  which is what `wasIngestedAsSource()` already does and must keep doing.
- **Non-qualifying source** (`generic.consumption` projected into an `electrical_energy` slot): the
  source event is not energy at all — `findSourceType` answers null for its own channel — so nothing
  ingests unless a projection does. There the **claim-holding projection** computes the delta, and
  the losing projections are skipped, which is the case `wasIngestedAsSource()` cannot see and where
  today's duplicates come from.

Stated the other way round: a projection ingests only when it holds the claim *and* its source would
not have ingested on its own. Anything looser double-counts the ordinary meter; anything stricter
loses the projected one.

**A projection may not change what the reading means.** `reportCompatibility()` accepts
`electrical_energy.grid_import` into an `electrical_energy.grid_export` slot — both are read-only
floats in kWh over the same range, so nothing structural separates them. Under the rule above the
source event is the one that ingests, carrying `GRID_IMPORT`, while the virtual device presents the
meter as export: the room's summary then reports the wrong field. So a claim requires the destination
slot and the qualifying source to map to the **same** `EnergySourceType`, and a cross-type pairing is
refused at persistence and reported by the wizard like any other incompatibility. Deriving the stored
type from the destination instead would be worse — it relabels a measurement rather than refusing a
mapping that was never meaningful. Where the source does not qualify there is no second type to
disagree with, and the destination's is simply used.

**A claim that goes away is inherited, not dropped, and the handover is atomic.** Deleting or
remapping the holder must promote a remaining projection of the same meter by the same deterministic
rule the migration uses — oldest, ties broken by id — and only leave the meter unclaimed when none is
left. Release, promotion and any competing claim have to be one operation: a create that reads the
claim after it is released but before a successor is promoted would take it, and the promotion would
then award it to somebody else. Since the delete path is outside the lock today, this is the argument
for the database-enforced claim rather than the lock — or for extending the lock to cover removal,
which is a change to shared code and should be decided rather than assumed. Otherwise a non-qualifying
source disappears from the totals entirely the moment its winner is removed, since nothing else
ingests it, and a qualifying one silently reverts to the physical device's room without anything
saying so.

**The delta baseline stays keyed to the physical meter.** `DeltaComputationService.computeDelta()`
keys its baseline `${deviceId}:${channelId}:${sourceType}`
(`delta-computation.service.ts:65`) and answers `null` for a key it has not seen. If the `deviceId`
handed to it changes when attribution moves to the virtual device, then the first reading after a
projection is created — and again after a claim is removed or remapped — has no baseline, and the
consumption accumulated since the previous sample is silently dropped. Computation must therefore go
on identifying the meter by its physical device and channel, with only the *persisted* attribution
taking the virtual identity. The test for this is a transition — readings before the projection, the
projection, readings after — not two readings taken once it already exists.

**History is not re-attributed — and the readers have to agree.** Stored deltas keep the room they
were recorded with, so splitting changes the future only, and that should be said where an operator
can read it rather than leaving anyone expecting a backfill.

The space queries do not honour that today, which the fix has to settle rather than inherit:
`getSpaceSummary()` and `getSpaceTimeseries()` reach the room by joining the device's *current*
`roomId` (`energy-data.service.ts:260`, `:383`), and `getSpaceBreakdown()` inner-joins the device row
itself (`:515`). So moving a device rewrites its history between spaces, and deleting one erases that
history from every space view, while `delta.roomId` sits there unchanged. It is pre-existing — every
physical device that ever changed rooms has the same shape — but a split makes it routine, and a task
that promises stable history while the read path contradicts it would be promising nothing. The
readers should use the recorded `delta.roomId`, with the join kept only where a *current* fact is
genuinely wanted.

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
      meter after the migration, deterministically chosen among the mappings the new rules accept —
      an older but cross-type projection does not take the claim from a younger admissible one, and a
      meter with no admissible candidate is left unclaimed rather than misattributed
- [ ] **And the household total is right afterwards:** the losing projections stop producing deltas,
      including where the source is non-qualifying and nothing else would have skipped them — a
      post-migration regression test on the total, not only on the per-room split
- [ ] A qualifying source that *is* claimed still produces exactly one delta, from the source event,
      carrying the claimant's room — not two
- [ ] A pairing whose destination slot means something else — `grid_import` projected into
      `grid_export` — is refused, rather than being counted under the source's type in a room that
      displays it as the other
- [ ] Removing or remapping the claim holder promotes another projection of the same meter, if one
      remains, so the meter neither vanishes from the totals nor quietly changes room
- [ ] A deletion racing a new claim on the same meter leaves exactly one claimant, whichever wins —
      tested by driving the delete and the create concurrently, not in sequence
- [ ] A refused claim leaves nothing behind: no projection without its claim, no claim without its
      projection, asserted after the rejected request rather than only on the winner
- [ ] Deleting a claimed source property clears the claim with the link — the orphan holds nothing,
      another projection of a recreated property can claim it, and the migration covers rows that
      were already orphaned
- [ ] An orphaned projection is attributed to the virtual device that holds it — there is no source
      left to fall back to. `VirtualValueSourceService.resolve()` answers `null` once
      `sourcePropertyId` is null, the registry then resolves the property to its own id, and
      `wasIngestedAsSource()` reads that as "not a projection" and ingests it. That is already the
      behaviour; the criterion is that the fix does not change it, and that an orphan therefore stops
      accruing rather than accruing in the wrong room, since no value reaches it once its meter is
      gone
- [ ] Moving a projecting virtual device to another room leaves its recorded consumption in the room
      it was recorded in, and deleting it does not erase that history from the space views
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
