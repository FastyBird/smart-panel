# Property actions and updater recovery: fresh assessment and completion plan

**Date:** 2026-09-27

**Status:** alpha.38 release and System upgrade verified; command/catalog overlap confirms residual metadata-read contention; virtual source graph reuse prepared; full-client acceptance remains open

**Initial reviewed revision:** `aa98d2c34000f76c538d877fa573bf98bfa174b4` (`1.1.0-alpha.23`), also GitHub `main` at review time

**Scope:** Property-command latency and convergence, System image updates, related validation and release work

## Alpha.38 command/catalog contention and virtual source graph reuse — 2026-10-01

PR #1140 shipped in alpha.38; all 19 release jobs succeeded. One install through the public System
API completed, preserved all 111 device identities, bindings, schema and migrations, and released
the updater lock. Keep the three preceding read-only discovery failures: one client timeout and
two attempts that did not offer the new version after manifest lookup failures. None submitted an
install. The successful request explicitly named the independently verified published alpha.38,
using the existing API option. This verifies installation, not reliable release discovery.

Normal-runtime comparisons ran 20 commands per version during concurrent full-device API reads.
Client-packet-to-RPC median/max changed from 1,064/3,883 ms on alpha.37 to 507/901 ms on alpha.38.
The alpha.37 observer timed out on one command, whose complete wire path took 5,159 ms; that failed
sample is retained. Alpha.38 completed all 20 without timeout. Median full-list client latency
increased from 1,237 to 1,531 ms. Separate sessions and uncontrolled background work limit causal
claims; client requests being in flight does not alone prove server-handler overlap.

A subsequent observational trace captured ten commands, each with confirmed server catalog-handler
overlap. All completed and returned OFF, with no missing wire paths, observer drops, packet drops or
reconnects. Preparation took 227–607 ms (median 519 ms). Each command issued 11 structural SELECTs;
the union of their native callback waits covered 188–482 ms. These waits include query queueing,
execution, native result conversion and event-loop scheduling, not just SQLite engine execution.
Structure/coordinator admission was below one millisecond. This is metadata reading, not a change
to property-value persistence, and the instrumented timings are not a candidate speedup result.

Incoming notification-to-alias publication took 4.7–139 ms. The largest sample included a first-use
metadata-cache read taking 118 ms. Another sample waited 93 ms between packet arrival and the JS
notification callback. Warm value publication remains on the memory-backed metadata path; Shelly
RPC and reply-to-notification delays remain outside the repair scope. This session had no qualified
poll-overlap commands and no Apple Home UI recording.

Virtual forwarding also independently loaded the source channel immediately before loading the
complete source device graph. The redundant channel read took 27 ms median and 125 ms maximum in
this trace. The candidate derives the parent identity from the property's joined relations and
reuses the channel from the fresh device graph. It keeps the ID-only relation fallback, full source
property/device reads, online checks and canonical admission. A channel absent from the fresh graph
rejects forwarding. No cache, schema, value-store, lock or process change is introduced.

Validation: 83 tests in four suites cover forwarding, command admission and real SQLite/HomeKit
convergence. The new real-SQLite graph regression preserves controls, sibling properties, units,
current values, inheritance and parent relations; it fails on the previous implementation's extra
channel lookup. Backend build and focused ESLint pass. Physical candidate timing remains pending.

Diagnostic artifacts were archived and the owned preload, capture, rollback timer and namespace
removed. Normal alpha.38 passed a further 126-second stable online/OFF gate and its SSH forward was
closed. The original epic and remaining acceptance obligations stay open.

- [x] Verify alpha.38 release, System installation and normal-runtime command/catalog comparison.
- [x] Attribute residual preparation and incoming publication under confirmed catalog overlap.
- [ ] Review/deploy source channel graph reuse and measure its normal-runtime effect.
- [ ] Reduce remaining catalog contention and complete qualified poll-overlap/full-client acceptance.

## Alpha.37 internal API stalls and bounded device loading — 2026-10-01

PR #1139 shipped in alpha.37; all 19 release jobs succeeded and one ordinary System upgrade
preserved device identities, bindings, schema and migrations and released the updater lock.
Normal-runtime command comparisons did not establish an end-to-end speedup. A 1.56-second interval
from an incoming Shelly notification on the Raspberry to publication remains an internal tail;
the preceding network/device response interval is outside the repair scope.

A targeted 20-command trace did not reproduce that incoming tail, but a separate full-device
readback overlapped a 2.2-second event-loop stall. Four subsequent read-only API measurements
reproduced 480–505 ms stalls during catalog loading. SQLite callback time includes worker execution,
scheduling and native row conversion; it is not a measurement of pure SQLite engine time.
These are structural catalog reads, not property-value persistence changes.

An alternating `relationLoadStrategy: 'query'` experiment was rejected: it was slower and returned
568 structural differences involving property units. A second six-request experiment retained the
joined graph and afterLoad subscribers, loading eight devices per query. The three ordinary reads
had maximum timer lag of 498–510 ms; the three batched reads had 81–158 ms. All six returned identical
normalized structural data for 111 devices and 1,732 properties; changing values/statuses were
excluded from that comparison. Client list latency increased from 1.12–1.29 seconds to
1.31–2.71 seconds, with the first batched read slowest. All samples are retained, with no dropped
observer records or capture packets. This is a small instrumented read-only comparison, not proof
of improved command latency or attribution of the earlier 1.56-second tail.

The candidate now uses sequential joined batches in `DevicesService.findAll`, retaining integration
and visibility filters and afterLoad subscribers. Tests cover real SQLite entity inheritance,
computed units/live values/statuses, controls/zones, disabled devices, deletion/visibility changes
between reads, empty results, sequential bounded reads and failure propagation. One large device
graph and final response serialization remain unbounded; the API remains a non-paginated response.
No new transaction, value-storage behavior, lock, process or dependency is introduced.

Validation: 129 targeted tests across five suites, the backend build, changed-file ESLint and diff
checks passed. The bounded-batch regression fails against unchanged main and passes with the fix.

All temporary staging instrumentation, captures, rollback timers and owned namespaces were archived
and removed. Normal alpha.37 passed another 123-second stable 111-device/online/OFF gate; no physical
commands were sent during either API strategy experiment, and the owned SSH forward was closed.

- [x] Verify the alpha.37 release and ordinary upgrade, retaining comparison limits and failures.
- [x] Reproduce catalog-read event-loop stalls and compare joined batching with unchanged metadata.
- [x] Review and deploy bounded catalog loading, then verify physical commands during catalog reads (alpha.38; residual latency remains).
- [ ] Complete qualified poll-overlap and full-client acceptance; leave the original epic open.

## Alpha.36 preparation tails and network-status sampling — 2026-10-01

PR #1138 shipped in alpha.36 through a successful 19-job release and one normal System upgrade.
All 111 device identities, the source/alias binding, schema and migrations were preserved; published
and deployed runtime hashes match and the updater lock was released.

Twenty normal-runtime commands before and after the upgrade measured median client-packet-to-RPC
preparation of 84.44 ms and 60.47 ms respectively. The candidate maximum was 755.82 ms, with the two
largest stalls on immediate OFF restores. Separate sessions and uncontrolled background work prevent
a causal speedup claim. Baseline downstream timing is complete for 18 commands: one capture started
mid-frame, so both downstream paths from that pair remain excluded. All 20 candidate paths are
complete, with one passive-wire poll overlap; this is not the full collector-qualified matrix.
One 8-second API precondition timeout occurred before any command/capture in that attempt and remains
unexplained. The five remaining pairs ran under a separately identified continuation, without
replacing or hiding the failed precondition.

A new bounded profile, after 126 seconds of stable readiness, captured ten further ON/OFF pairs.
All 20 commands, RPC replies, notifications and source/alias publications completed; there were no
dropped observer records or kernel packets. Wire preparation ranged from 42.43–169.48 ms
(median 59.97 ms), so the previous 562/756 ms tails were not reproduced. The slowest internal path
was 165.26 ms; its query waits overlapped sensor/lighting graph reads, while structure/coordinator
admission stayed below 0.26 ms and overlapping GC took 9.55 ms. This is diagnostic correlation,
not proof that previous value-event work caused the earlier tails. Metadata generation did not
change. Observed SQL UPDATEs targeted space metadata and buddy suggestions, not property values.

CPU sampling identified synchronous systeminformation network probes during a separate roughly
607 ms event-loop delay. A roughly 953 ms delay at profiler activation belongs to the observer
itself and is excluded from product findings. Other long native/ORM/API intervals remain unassigned;
full-device readbacks in the test also generate load. The profile's CPU timestamp alignment is
approximate and corrected for profiler-start initialization; fine timing uses the span/packet data.

A separate command-free Raspberry probe, without the preload or CPU profiler, reproduced
`networkInterfaces('default')` blocking the event loop for 286–301 ms. The candidate reads only the
four network fields consumed by system status, using a bounded asynchronous `ip -j route show default`
probe and Node's interface addresses on Linux. It retains the one-minute cache, external-interface
fallback when routing information is unavailable, and systeminformation on other operating systems.
No extra backend process, dependency, value-storage change or structure-lock change is introduced.

Five alternating isolated comparisons on the same Raspberry measured the published probe at
281–303 ms, with 281–303 ms maximum timer lag. The candidate took 2.62–4.71 ms, with 1.57–2.51 ms
maximum timer lag, and returned identical consumed status fields in all five comparisons. This is
verification of the network probe only: the candidate is not deployed in the running backend and
no end-to-end command improvement is claimed. Other synchronous systeminformation calls remain
outside this focused change, including default-interface lookup inside `networkStats()`.

Validation: 66 focused platform/system unit tests, the backend build, changed-file ESLint/Prettier
and diff whitespace checks passed. Tests cover pending asynchronous probes, timeout/missing-command
fallbacks, malformed routes, address changes, IPv6 fallback and cache expiry. Review added alias-aware
route matching with exact-name precedence and a colon boundary; its alias-only regression first
failed against the original candidate by selecting the unrelated fallback interface.

The profile was privately archived and hash-verified; its preload, capture, rollback timer and
owned remote namespaces were removed. Published alpha.36 resumed normally, passed another stable
111-device/online/OFF gate, and the owned SSH forward was closed.

- [x] Merge/release graph reuse and verify the ordinary alpha.36 upgrade.
- [x] Retain comparable command observations, incomplete paths and precondition failures explicitly.
- [x] Reproduce a blocking network-status probe and verify a focused asynchronous replacement.
- [x] Review/deploy the network-probe change and repeat normal-runtime command measurements (alpha.37).
- [ ] Explain remaining preparation/API tails and complete qualified poll-overlap/full-client acceptance.

## Alpha.35 HomeKit convergence and command preparation — 2026-09-30

PR #1137 shipped in alpha.35 through a successful 19-job release workflow and one normal System
upgrade. A corrected observational preload preserved Nest listener metadata and queued-callback
context. The valid manual test contained ten alternating clicks: all ten reached HomeKit ingress,
outgoing Shelly RPC, successful replies and device notifications. Sequential video decoding found
ten visual transitions without an extra reversal. One obsolete ON report arrived after the next
OFF command and was correctly held; nine source publications therefore represent convergence, not
a missing command. Two reply-to-notification wire intervals exceeded 500 ms. No actual poll overlap
occurred during this test, so it does not complete the outstanding poll-overlap acceptance.

The earlier observer-v1 run is excluded from acceptance because its wrapper removed Nest listener
metadata. An initial broad profiling run overflowed its row cap; five complete root spans remain
partial diagnostic evidence only. Those spans include slow SQL reads and a 29 ms structural barrier
wait during a period of frequent metadata invalidation. Their cause has not been established.

A narrower, bounded profile after a 120-second stable readiness gate captured four automatic HomeKit
commands with no dropped records. Preparation before outgoing RPC took 46.77–66.46 ms, with ten SQL
reads per command. Incoming value updates took 4.66–6.60 ms; structure admission took 0.08–0.11 ms.
The first metadata read missed the cache and the next three hit; its generation stayed unchanged,
with zero structural mutations during the 90-second capture. This does not establish a steady-state
cache invalidation defect or justify removing the structural barrier.

The next candidate reuses the channel already loaded by the execution-time device graph instead of
hydrating that channel, its controls and sibling properties again for each command. The removed
lookup took approximately 5–8 ms in these instrumented samples; this is not a demonstrated end-to-end
speedup. The separate property read remains because it supplies the nested `property.channel.device`
relation to platform consumers. Canonical admission, fresh property validation and virtual source
forwarding remain in place. The real SQLite regression distinguishes four preparation SELECTs before
this change from three afterward, before the separate dispatch/admission stage.

Validation: all 563 backend unit suites passed (8,869 tests, one existing skip), as did all 23 E2E
suites (256 tests), backend type checking/build, formatting of changed TypeScript and diff whitespace
checks. Backend ESLint passed with three warnings in unchanged files. The SQLite regression failed against the
original channel lookup (four SELECTs rather than three). Tests also compare the reused channel
with the standalone query result and cover deletion, reparenting, permissions and invalid values.

Both profiling runs were archived privately and their owned remote files, preload overrides, capture
processes and rollback timers removed. Normal alpha.35 passed a subsequent 125-second stable
111-device/online/OFF check; direct Shelly output was also OFF and the owned SSH forward was closed.
The first post-restore readiness attempt timed out after a late reconnect and remains recorded.

- [x] Verify ten-click Apple Home convergence with corrected observer metadata and sequential video.
- [x] Separate warm command preparation from incoming-value commit and metadata cache behavior.
- [x] Review and deploy the channel graph reuse candidate, then measure comparable normal-runtime latency (PR #1138, alpha.36; limitations above).
- [ ] Complete actual poll-overlap and the remaining full-client acceptance before closing the epic.

## Alpha.34 command preparation profile — 2026-09-30

PR #1136 shipped in alpha.34, whose complete release workflow finished successfully (19 jobs).
The normal System upgrade preserved all 111 device identities, the source/alias binding and
schema/migration hashes and left no updater lock. Published and deployed runtime hashes match.
Live discovery retained the healthy Ethernet transport when the same Shelly announced a Wi-Fi
alias: the short identity probe closed after verification without replacing the active connection.

Twenty normal-runtime idle commands completed on the same Ethernet peer. Client packet to outgoing
RPC had a median of 84.8 ms and a maximum of 636.2 ms; inbound notification to alias publication had
a median of 5.5 ms and a maximum of 26.1 ms. Four commands spent 1.28–1.39 seconds between the RPC reply
and inbound notification. No command had a qualified poll overlap. A separate pre-command peer
precondition failure is retained alongside the successful samples; it is not a command result.

A subsequent bounded observational preload correlated twelve further commands with packet captures.
Each performed twelve SQL reads, including three full device graph loads, before outgoing RPC.
JavaScript receipt to RPC send was 58–219 ms; structure/coordinator admission waits stayed below
0.2 ms. Timeout-budget resolution alone took 9.9–18.4 ms (median 12.5 ms) and hydrated a device graph
that execution immediately loaded again. Inclusive query spans overlap and must not be summed as
exclusive wall time. These instrumented samples are diagnostic evidence, not a speedup benchmark.

The candidate replaces only that budget lookup with a parameterized raw identity/discriminator read.
Platform timeout selection needs the integration type and command count, not channels, values or
connection state. Execution still loads the full device and canonical admission still performs its
fresh checks under the structure barrier. Missing metadata or lookup failure retains the existing
fallback timeout; metadata is not cached. Virtual forwarding retains its full graph because some
source integrations inspect sibling channels/properties. This removes hydration from one query,
not every command-path database read, and does not add property-value writes to SQLite.

Validation: 121 tests across seven suites, backend type checking/build, focused ESLint/Prettier and
diff whitespace checks passed. The command regression first failed against the original code with
two full graph loads instead of one. Real SQLite tests cover the inheritance discriminator, missing
IDs, bound input, deletion/replacement and zero entity-load subscriber calls for budget metadata.

The twelve diagnostic commands all converged and restored OFF. Trace and packet evidence were
archived locally; the preload, timer and owned remote files were removed. Normal published alpha.34
restarted with no diagnostic environment overrides, matching runtime hashes, 111 devices, both target
devices online and source/alias/direct switch OFF. The owned SSH forward was closed.

- [x] Correlate command preparation spans with the actual outgoing RPC on staging.
- [x] Remove full graph hydration from timeout-budget lookup and add regression coverage.
- [x] Review and deploy the budget metadata candidate (PR #1137, alpha.35).
- [ ] Measure under comparable normal-runtime conditions; instrumented diagnostics alone do not prove a speedup.
- [ ] Complete actual poll-overlap and rapid-toggle/full client acceptance.

## Live provider publication and history buffering — 2026-09-29

### Alpha.32 staging verification and shutdown follow-up

PR #1134 merged as `372d5775f83a0c77d8b573416e31aa926d31bd10` and shipped in alpha.32.
The ordinary System API upgrade from alpha.31 completed once, preserved all 111 device identities,
the source/alias binding and schema/migration hashes, and left no updater lock. Published server,
npm and deployed runtime bytes match. All six measured history values survived a normal restart
with exactly the same timestamps and values in a fixed query window.

Six exploratory commands per version are **not a controlled before/after comparison**: baseline
RPCs used the Shelly Wi-Fi address, whereas alpha.32 used its Ethernet address. Provider-notify to
alias publication was 5.3–11.1 ms on alpha.32. Its slowest operation took 1.538 s, including 1.445 s
between RPC reply and inbound status; pre-RPC outliers still reached 263 ms. A later spontaneous
disconnect lasted about 27 seconds. These observations leave transport/reconnect and server work open.

One real Apple Home ON/OFF cycle was recorded locally: 1,847 decoded frames showed OFF → ON → OFF
without an observed reversal (maximum frame gap 83 ms). This is not rapid-toggle or full client
acceptance. Recording was stopped; the source and alias ended online and OFF with no diagnostic
runtime overrides. The staging backend remains the published alpha.32 build.

The normal restart exposed 86 `Storage write buffer is closed` errors during final provider reports.
`StorageService.onModuleDestroy` closed admission before the managed-service manager finished stopping
producers. The correction moves closure to `onApplicationShutdown`; existing reverse-priority service
shutdown and unregister/drain-before-destroy remain responsible for final writes. A real Nest application
close regression covers empty and saturated buffers and verifies final history precedes backend destruction.
This remains part of the existing provider-history work, not a new architecture workstream.

- [x] Deploy the history-buffer candidate and verify normal upgrade and persisted history after restart.
- [x] Capture one ordinary Apple Home ON/OFF cycle with no observed reversal.
- [ ] Deploy the shutdown-order correction and verify final provider reports during a normal restart.
- [ ] Complete controlled latency and rapid-toggle/full client acceptance.

### Original implementation and alpha.31 observations

PR #1133 merged as `97dcbd4b5eb0e1b1c052d4e6d6cddf3cb9d2b5db`; alpha.31 includes it and #1132.
The ordinary System API upgrade from alpha.30 completed, preserved all 111 device IDs and the current
source-property/alias binding, retained schema/migration hashes and released the updater lock. Server,
npm and deployed runtime hashes match. The first release attempt published the backend but failed its
240-attempt registry visibility check; only failed jobs were retried for the same version.

Six exploratory operations per version used the same Shelly Ethernet address. Pre-RPC timing changed
from 105–438 ms (median 205) to 56–174 ms (median 99). This is a small before/after sample with uncontrolled
background work, not the qualified acceptance matrix. One alpha.31 operation took 4.218 s: 136 ms before
RPC, 48 ms to reply, 4.003 s until inbound status, then 30 ms to alias publication. Slow ON replies were
retransmitted despite immediate outgoing Pi ACKs. This locates the delay before inbound status, without
establishing Shelly-versus-network causality. A ten-minute follow-up also captured a five-second Shelly
detach/reattach; uninterrupted readiness and Apple Home visual acceptance remain open. Target ended OFF.

A separate candidate now lets hook-free provider value reports publish after bounded history admission
in the default single-process mode. It does not change strict/adoption/CAS persistence or the opted-in
shared-writer behavior. The storage buffer admits at most 1024 points including the active batch, batches
adjacent points with the same captured destinations, and applies backpressure when full. Points and
backend instances are captured; old history is not redirected into a replacement plugin. Failures are
logged with existing best-effort semantics, without automatic retries or rolling back accepted live state.

Legacy awaited writes, strict reconciliation, durable snapshots and property deletion drain previously
admitted history. Structural metadata/source changes drain under exclusive admission. Storage plugin
unregistration is awaited before destroying its connection. The premature module-shutdown closure in
the original candidate is corrected by the lifecycle follow-up above.
This is process-local buffering, not a durable outbox: abrupt process loss can lose queued history, and
saturation/strict/lifecycle barriers still wait for storage. Ordinary history queries can lag live values.

Regression coverage includes a real SQLite/HAP fixture with controlled slow storage: the old awaited
provider path fails to publish before storage completes, while the candidate publishes source/aliases
and HAP characteristics. Late history completion cannot replay an older visible state. Buffer tests cover
capacity, batching, ordering, immutable snapshots, backend replacement, failure and shutdown; value tests
cover strict/CAS/read/delete barriers and fresh-service readback after drain. Hardware verification of this
candidate is recorded above; the original full client matrix remains separate from these deterministic tests.

Local validation: 777 tests across 35 distinct suites (including the final HAP/readback cases), backend
type checking/build, focused ESLint/Prettier and diff whitespace checks passed. No schema, dependency
or generated API change is involved.

## Discarding superseded Shelly discovery instances — 2026-09-29

PR #1132 merged as `29e557015f7ebb5b3500905762dd3e305101a6e1` after successful CI and a
CodeRabbit review covering the final commit (`dbf62f026`), with Minimal merge risk, Low security
risk and no actionable comments. It is not yet in a published release; staging remains alpha.30.

Further investigation reproduced a distinct startup race. The library can replace a canonical
`Device` and destroy the removed instance's RPC handler while the backend still has that instance
queued, awaiting its database lookup, or awaiting provisioning. The connector lifecycle generation
has not changed, so the existing generation guards allowed the obsolete instance to attach again.
Six regression cases (three wait locations, each with replacement or removal) failed on the original
code by inserting the removed object. This explains a concrete way to attach an unusable transport;
it does not assign every startup delay or reconnect to this race.

The guard checks both the connector generation and `Shellies.get(device.id) === device` before the
lookup and after each lookup/provisioning await. It discards superseded objects without closing the
current transport. Connection state is deliberately not an admission condition: the current transport
can be temporarily disconnected and still need normal recovery. A provisioning call already started
is not cancelled; ownership is checked again before delegate insertion. Existing insertion draining
on connector stop/restart remains in place.

Validation: 106 tests across connector, delegate manager and provisioning suites; full backend type
checking/build and focused ESLint/Prettier passed. The six cases now reject the destroyed old instance
and still process the latest instance, including when its transport is reconnecting. Existing shutdown
and in-flight insertion tests remain green.

A bounded one-module staging overlay reproduced the production condition directly: eight discarded
instances still matched the connector generation but had a destroyed RPC handler. One was the test
Shelly, whose replacement already had a connected transport. The target subsequently became online;
source and alias remained OFF, all 111 device IDs and the target/alias property IDs were unchanged.
No physical commands were sent. The overlay and private runtime probe were archived and removed,
and normal published alpha.30 restarted. This confirms the ownership race, not a startup-time SLA:
the single target still needed roughly two minutes to become ready in the sequential discovery queue.

## Alpha.30 upgrade and command-read findings — 2026-09-29

PR #1131 merged as `b47a969833129e6367b679298989f79a43f669d2`. Alpha.30's complete release
workflow succeeded on attempt 2, including all Raspberry images. Only failed jobs were retried after
npm visibility lag; this did not create another release. One normal System API staging upgrade
completed, its worker exited and its lock disappeared. All 111 device IDs, the schema and 28 migration
records were preserved; SQLite integrity was OK. Deployed backend/library files matched the verified
published artifacts. A normal Shelly plugin restart completed in 7.528 s without restarting the backend.

The switch's original source property had already disappeared **before** installing alpha.30. Startup
created a replacement; the test alias was explicitly remapped to it, and that replacement survived the
plugin restart. This is fixture recovery, not evidence that the original identity was preserved. After
readiness, a two-minute observation showed one target TCP connection and no target reconnect log records.
Startup/restart readiness can still take several minutes, with intermediate UNKNOWN status and delegate
replacement; the short steady-state observation does not establish that all lifecycle issues are closed.

Three normal-runtime ON/OFF pairs all converged and restored OFF. Pi packet timestamps measured
123–418 ms before outbound RPC, 23–37 ms to the RPC response, and 13–80 ms from incoming notification
to alias publication. One 1.876 s command spent 1.529 s between the RPC response and incoming status
notification. This separates that device/network interval from Smart Panel processing, without assigning
it conclusively to either Shelly firmware or the network.

A separate trace of the published alpha.30 code (no behavior overlay) completed another six operations.
Pre-RPC time was 124–344 ms. In five of six traces, a single command loaded 106 property entities,
performed six full device lookups and issued 16 SQL queries before platform dispatch. The remaining
trace also inherited overlapping asynchronous work and is not used as the deterministic query count.
Shared structure admission waited only 0.020–0.024 ms. DTO existence validation took 33–46 ms;
redundant channel/device reads during canonical admission took another 24–76 ms. One 1.616 s command
again spent 1.440 s waiting for the incoming notification, after its RPC response.

The candidate replaces existence validators' full graph reads with fresh SQL EXISTS queries, retaining
parent existence and ownership joins without entity/value/status subscribers. Canonical admission reuses
the channel/device already joined by its fresh source-property lookup under the lifecycle barrier,
with the existing ID-only fallback. Alias revalidation, value normalization, platform dispatch, runtime
status checks and persistence semantics stay in their existing paths. This does not eliminate every
command-path ORM read, implement a metadata cache, or change history publication semantics.

Candidate validation: 233 tests across ten suites, full backend type checking/build, focused lint and
formatting passed. A joined-admission regression first failed against the original code. Real SQLite
DTO tests cover valid and missing IDs, mismatched parents, deletion, orphan rows and zero entity-load
subscriber calls. Existing command-window/remap and hidden-device selection tests remain green.

A bounded seven-module overlay of the built candidate completed another three ON/OFF pairs, all
converged and restored OFF. Full device reads fell from six to three per command; five traces loaded
54 property entities and issued 12 SQL queries (the remaining trace loaded 52/10). Pre-RPC packet time
was 60–194 ms, median 75.7 ms, versus 124–344 ms, median 159.6 ms, in the preceding instrumented baseline.
Five DTO validations took 2.6–11.7 ms; one still took 76.6 ms, with its three SQL queries each awaiting
completion for approximately 73 ms and no overlapping >30 ms loop-lag record. SQL contention/scheduling
therefore remains an open boundary despite the lower query/hydration count.

These are six diagnostic operations per build, not a qualified latency distribution. Discovery selected
the Shelly Wi-Fi address for the candidate versus Ethernet for the baseline, so end-to-end/network
latency is not a controlled comparison. The reduced graph reads and pre-platform timings identify the
backend work removed; they do not establish a universal percentage improvement. One candidate RPC took
447 ms on the wire. Both diagnostic runs were archived, overlays and capture namespaces removed, and
normal published alpha.30 restarted. Startup readiness and Apple Home visual acceptance remain open.

## Persistence and system-probe findings — 2026-09-29

Additional packet-correlated tracing with the merged metadata overlay reproduced a **2.347 s**
notification-to-alias delay. The notification and outbound command used the same TCP connection;
JavaScript received the notification **0.173 ms** after packet completion. Metadata/admission finished
promptly, but `StorageService.writePoints()` took **2.341 s** before the source event could publish.
The complete command took **4.018 s**: 142.7 ms before RPC, 54.0 ms to its response, 1.474 s until
notification and 2.347 s inside Smart Panel. Six operations converged and restored OFF. Pre-dispatch
latency in this sample was 115–259 ms; the earlier 2.70 s pre-dispatch outlier was not reproduced.

A separate finer storage trace identified **1.579 s** and **0.522 s** Influx writes. Memory writes
remained below 0.24 ms across 443 traced writes. For the 1.579 s write, the HTTP request finished
writing within 0.2 ms, then awaited a successful HTTP 204 response; no >30 ms event-loop stall was
observed during that interval. This is an application-observed HTTP delay, not an Influx server/disk
profile. That write belonged to a background Shelly `ensureProperty()` update, which held the global
exclusive structure barrier for **1.584 s**. It demonstrates how persistence can delay both publication
and unrelated command admission, but does not retroactively attribute the earlier 2.70 s command.

A 90.6 s CPU profile independently exposed expensive platform probes: approximately 3.42 s of sampled
time was in native process spawning, including `systeminformation` graphics, network, CPU and time
probes. Some use `execSync` on the main thread. Aggregate CPU/memory usage alone cannot exclude short
event-loop stalls. The system broadcaster and stats aggregator both request system info every five
seconds; Raspberry's resolution fallback also called `si.graphics()` outside the existing cache.

The narrow mitigation merged in #1128 (`f5c7e2ba0`) shares a pending system-info sample among concurrent consumers
and reuses cached graphics for the resolution fallback. It keeps fresh framebuffer/fbset checks and
returns independent response models; successful and failed samples are released for the next poll.
Callers share a ten-second timeout from the start of the sample. If it expires, subsequent callers
fail promptly while the underlying platform promise remains pending, rather than attaching indefinitely
or launching replacement probes. Late completion/rejection permits the next fresh sample and is handled
without publishing an expired result. The platform interface does not support cancellation: a permanently
hung sample still needs platform/process recovery, and a JavaScript timer cannot preempt synchronous
main-thread blocking. This bounds asynchronous caller waiting, not the lifetime of every OS probe.
It does **not** move all platform probes off the event loop or change persistence/lock semantics.
Validation: 52 tests across system service/controller, platform service and Raspberry resolution suites;
backend type checking and focused linting. No staging latency improvement is claimed for this change
before deployment. All temporary overlays, profiling and captures were removed, with alpha.28 restored.

The finer storage run completed one ON/OFF pair, then rejected a subsequent command while the Shelly
delegate was detached/replaced. That rejected trial is excluded from latency acceptance. Independent
HTTP readback confirmed OFF; normal-runtime source and alias were subsequently online/OFF.

Remaining work, ordered by the measured blocking boundaries:

- [x] Implement and locally verify unchanged-metadata reports from Shelly `ensureProperty()` without
  exclusive admission or SQLite metadata writes, preserving real changes, validation and lifecycle locking.
- [x] Review and deploy the unchanged-metadata optimization in alpha.29 through the normal System API.
- [ ] Measure staging lock admission and publication latency separately after restoring target readiness;
  the persistence delay remains a distinct boundary.
- [x] Implement and locally verify hook-free provider publication after bounded history admission in
  single-process mode, preserving strict reconciliation, deletion/remap barriers, shared-writer mode
  and fresh-service readback after drain. Keep the documented saturation/failure/shutdown semantics.
- [x] Review/deploy the history-buffer candidate and verify persisted values after normal restart.
- [ ] Verify the shutdown-order correction on staging and complete controlled live latency acceptance;
  strict, metadata-hook and legacy callers intentionally retain awaited persistence.
- [ ] Attribute slow Influx HTTP responses using server/disk evidence and verify the above changes
  under a controlled delayed storage response, independently of Shelly network timing.
- [ ] Remove remaining main-thread synchronous platform probes and measure their impact after the
  duplicate work mitigation. Reduce repeated command-path ORM reads without weakening ownership checks.
- [ ] Complete successful/canonical Shelly replacement lifecycle coverage, then repeat stable real
  device, Apple Home and normal-upgrade acceptance. Failed-discovery cleanup from #1126 covers a
  different lifecycle boundary.

## Successful Shelly connection cleanup — 2026-09-29

A real local WebSocket regression reproduced a separate leak: discovery of a device by its configured
name resolves to an already-adopted canonical ID, replaces that instance, and previously left the old
RPC socket connected. `Shellies.delete()` and `clear()` removed collection entries without destroying
their transports. Backend delegate teardown only removes listeners, so it did not close those orphaned
clients either. This establishes a lifecycle defect; it does not prove how many staging reconnect log
records came from this path or that it explains all observed latency.

The fix merged in [FastyBird/node-shellies-ds9#3](https://github.com/FastyBird/node-shellies-ds9/pull/3)
as `ca42c0c8251a08c3985fce26425a4c2e55e7e753`. Removal/replacement now starts RPC destruction; clear
also invalidates discovery loads already in progress. Destroyed clients reject late requests and ignore
manual reconnects, including a connection attempt that was awaiting an old socket's close. Active
clients retain ordinary network recovery. The ID returned by the device is consistently used to check
adoption, including case-only discovery differences. Removal stays synchronous; it does not wait for
all close handshakes. Cleanup errors use the library error event.

Library validation: 51 tests across five suites, TypeScript build and full ESLint. The real socket test
failed before the repair, then covered replacement, active-client network recovery, clear and stale
request/reconnect attempts. Additional coverage includes clear during info/status/config loading,
cleanup failures, throwing removal listeners and case-only IDs. Committed runtime artifacts were
regenerated. The Smart Panel dependency pin and generated lockfile now select this merged revision.

Backend shutdown also retained the database discovery listener and the mDNS discoverer. Those could
feed new discoveries into the cleared instance. The connector now unregisters both discoverers before
clearing devices, stops mDNS with a five-second bound, and releases discovery resources after a failed
startup. Cleanup continues if mDNS stop rejects or times out. Pending backend discovery work checks its
lifecycle generation after lookup/provisioning so it cannot attach an old delegate after stop/restart.
Two service regressions first failed for the retained registrations on stop/startup failure. Tests also
cover restarting, late lookup/provisioning completion, and rejected/timed-out mDNS shutdown.
The low-risk review also identified an already-admitted insertion racing with detach. Four regression
cases failed before the follow-up: normal/forced insertion, with successful/failed partial setup.
The connector now tracks the admitted insertion and awaits settlement before delegate teardown;
its lifecycle lock prevents restart until that cleanup completes. Generation checks still discard
lookup/provisioning work which has not entered insertion. A rejected insertion is reported by the
discovery queue and does not skip cleanup. This drain deliberately waits for completion rather than
timing out and allowing that operation to mutate handler maps after restart.

Backend validation: 100 tests across connector, delegate manager and provisioning suites; full backend
type checking, focused ESLint/Prettier and diff checks passed.

At the pre-merge checkpoint staging was still on alpha.29, containing neither this connection fix
nor #1130. The alpha.30 deployment, connection observation, explicit alias repair and resumed command
measurements are recorded above. The old source identity was already lost before alpha.29; restoration
is not identity preservation. Awaited Influx persistence and remaining synchronous probes are still
independent latency work.

## Partial provisioning and staging readiness — 2026-09-29

PR #1129 merged as `97bbc81e4` after successful CI and a latest-commit CodeRabbit assessment of
minimal merge risk / low security risk. Alpha.29 was dispatched from that commit to deploy #1127–#1129
through the normal System upgrade. Before any upgrade or physical command, alpha.28 inventory already
showed the test source property missing, its virtual alias binding null, and the source device offline.
Direct Shelly readback returned OFF. The baseline trial stopped before listener readiness and sent no
command; it is not a latency sample. A consistent database/config backup and device inventory were saved.

Alpha.29 was subsequently published and installed through one normal System API request. The first
release attempt failed the npm visibility check after publishing the backend; the tarball was already
available with the expected hash while package metadata returned 404. A failed-jobs-only retry completed
publication after metadata became visible. Server and npm hashes matched for all five changed runtime
files; the deployed files matched that verified artifact. The upgrade exposed STARTING, reached COMPLETE,
released its worker lock, preserved all 111 device IDs and the unchanged schema/migration history, and
passed SQLite integrity checks. The service journal recorded successful deactivation and restart.
The original source identity remained missing and the alias remained unbound; a replacement switch:2
property was observed. Independent device readback remained OFF. No physical command was sent, and
there is no post-upgrade latency acceptance result. Raspbian image builds continued after server upgrade;
all release jobs subsequently completed successfully on workflow attempt 2.

A retained alpha.28 journal segment (03:36–11:10 local time) contained 94,524 connected, 94,520 disconnected
and 135,437 reconnect-scheduled log records for the test Shelly, plus component RPC failures. These are
log-event counts, not unique TCP connections. The segment starts after the alias became disconnected,
so it cannot prove the exact deletion that originally detached the alias. Evidence is retained privately
as a checksum-verified compressed archive. No credentials or full device inventory belong in the repo.

Regression tests establish a destructive provisioning path independently: when a component RPC or
property write rejects, `Promise.allSettled()` logs the failure, then stale-channel pruning treats
unvisited channels as removed. This can delete existing switch/energy/power channels and their property
identities. The guard merged in #1130 (`f41447a0b`) skips the final pruning pass if any component failed, including the separately
handled device-power RPC. Successful component updates still apply; the next complete pass removes
truly obsolete channels. Tests first failed on the original deletion calls and pass with the guard,
including successful retry. Existing input preservation and complete provisioning tests remain covered.

This guard neither restores already detached aliases nor fixes the reconnect lifecycle. Those remain
prerequisites for representative device/HomeKit latency acceptance. Preserve the failed baseline and
verify the published upgrade independently; do not silently relink an alias and call the original
identity intact, or attribute the pre-existing missing property to alpha.29.

## Unchanged Shelly metadata — 2026-09-29

Shelly discovery supplies metadata together with each value, which previously selected the structural
update path even when every metadata field matched. Its repository save invalidated the metadata cache,
and the exclusive lifecycle barrier remained held while Influx persisted the value.

An internal `skipUnchangedMetadata` option now lets `ensureProperty()` request comparison of the
validated, mapped fields after shared lifecycle admission. Equal metadata uses the existing value path.
Different metadata leaves shared admission and retries the original exclusive path with a fresh row;
mapper hooks, strict persistence and timestamp/command-origin options retain their original behavior.
The existing field comparison is shared between both paths. No schema or public API changes are needed.

Local validation: 161 tests across property updates, Shelly discovery, real SQLite/HAP convergence,
command dispatch and lifecycle locking. The integration fixture runs with durable value locks both off
and on. It covers changed fields, invalid metadata, queued metadata changes/deletion, stale HomeKit
reports and delayed storage: unrelated readers can enter, while structural mutations still wait.
With warmed metadata and durable locks off, the metadata-bearing update performs no SQL. Discovery's
preceding lookup can still read SQLite. Value persistence remains awaited, so this does not fix the
measured Influx response delay or claim a staging latency result. During this local validation, staging
remained on unmodified alpha.28. Alpha.29 was subsequently installed through one normal System API
request, as recorded in the staging-readiness section above; physical latency acceptance remains open.

## Metadata receive-path mitigation — 2026-09-29

Fine-grained staging tracing confirmed that metadata cache misses rebuilt all **1,732 properties**.
Across 322 completed rebuilds during discovery, median query-plus-hydration time was **115.75 ms**;
the SQLite query-runner span was **71.88 ms**, with approximately **40.10 ms** of remaining work
(medians calculated independently). Any structural change invalidated the complete catalog.
Earlier packet-correlated target trials attributed 109–129 ms to metadata lookup versus 0.025–0.043 ms
with a warm cache.

The mitigation preserves startup preload and global structural invalidation, but refreshes only the
requested row after invalidation. Concurrent reads share a per-property load; old-generation results
cannot repopulate the cache. Shared-writer mode keeps fresh reads. No schema, durable-lock, storage or
command-window semantics change.

An unpublished service overlay was tested on alpha.28 with the same temporary tracing and bounded
packet capture. Across the completed trace, single-row queries had a **2.22 ms** median. Three ON/OFF pairs all converged and
restored OFF; packet receipt of NotifyStatus to alias publication was **10.9–39.2 ms** across six operations.
This is a small diagnostic sample during discovery, not steady-state acceptance or a published release.
Some background single-row query spans still reached 1 s, so scheduling/storage tails remain to investigate.

End-to-end latency remains open. The slowest overlay command took 3.80 s: **2.70 s before outbound RPC**,
40.5 ms to its response, **1.02 s until notification**, then **39.2 ms to alias publication**. Another command
waited 1.35 s between response and notification. Investigate pre-dispatch admission/lookup independently
of transport/device timing. The historical 1.57 s post-notification outlier was not reproduced with the
finer probe; its exact cause must not be declared resolved by this mitigation.

Validation: 145 tests across seven metadata/value/coordinator/structure/convergence suites, full backend
type checking and focused linting. Tests cover coalescing, independent keys, preload/load invalidation
races, failed-load retry, transaction commit/rollback, deletion and shared-writer mode. Temporary overlay
and diagnostics are removed after measurement; this experiment does not publish a release or migrate data.

## Alpha.26 normal-upgrade result — 2026-09-28

PR #1122 merged as `843f3e0039ba260562708cff33c657e72bac4578`. The authorized
[alpha.26 release](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.26)
names version-sync commit `6156106533db123fcd295b9737465b53a6d16378`. Its ARM64 archive SHA-256 is
`7aa29bfde8f75d0d51a622c4121bce05a6048d72b8bb6930b6c2ae5c09f8b67b`. Published archive and npm updater
implementations match the tested build byte-for-byte.

A separate bootstrap installed `alpha.25+review.843f3e003` with the repaired source worker,
preserving the live runtime and an offline copy of the previous database/configuration/attempt.
Exactly one normal System API install request was accepted at **00:07:51 UTC on September 28**.
Attempt `1790554071-619957` completed at **00:09:07 UTC**, and the restarted alpha.26 backend
reported **COMPLETE** without the previous false failure. The worker exited successfully and
removed its own lock. No manual lock deletion, migration-history editing or repeated install was used.
All 111 devices and their property mappings, database schema and 28 migration-history records are
unchanged; the real migration CLI reported no pending migrations.

A real service-user probe during startup read the root-owned attempt and received `EPERM` when
probing its live owner, while record writes and lock/private migration-log reads remained denied.
The backend journal confirms that initialization returned while it observed the live worker, then
reconciled the durable completion. This closes the observed permission/false-failure boundary.
It does not establish automatic first-hop compatibility for older installed workers: those still
require the separately documented bootstrap/recovery step.

The API exposed a narrower remaining display issue: polls at **00:09:02** and **00:09:05 UTC** returned
IDLE before COMPLETE at **00:09:08 UTC**. Durable ownership already prevented a second worker;
inspection showed that the new process observed startup without restoring its in-memory progress.
The follow-up restores STARTING/85% synchronously when observing a live `starting` attempt, while
completion still requires durable settlement. Tests cover startup with/without a public status file,
EPERM, nonblocking initialization and rejection of another update. The real root/service-user fixture
also asserts STARTING before initialization returns. This follow-up is not deployed on staging.

Source and virtual target were online and OFF after the upgrade. A fresh Apple Home UI smoke could
not run: Home was running, but both name and bundle-ID attachment returned `cgWindowNotFound`.
No post-upgrade visual flicker result is claimed. The 20+20 timing matrix and full client acceptance
remain open; they are not prerequisites for recording this successful normal updater execution.

## Alpha.25 normal-upgrade result — 2026-09-28

PR #1121 merged as `95c5cbf86a1b96ca3163442538098327d3a46527`. The authorized
[alpha.25 release](https://github.com/FastyBird/smart-panel/releases/tag/v1.1.0-alpha.25)
names version-sync commit `ba21c789f9e34630523c6b0ba62f0ec165e0f3a0`. Its server archive SHA-256 is
`cd370d552b4e5e7021e8bb3a058b3d773647bae907b8832aefde00a437927222`; compiled executor,
privileged launcher and worker were checked against the tested source/build.

An authorized staging rebuild preserved the complete old runtime, including the failed alpha.24
attempt and lock. It bootstrapped an explicitly unpublished `alpha.24+review.95c5cbf86` source
with the repaired launcher, preserved 111 devices and HomeKit pairing, and verified an isolated
Apple Home ON/OFF cycle. This bootstrap is distinct from a normal update or legacy-hold recovery.

Exactly one normal System API request was accepted at **22:36:56 UTC on September 27**. Attempt
`1790548616-549198` passed stop/quiescence, ran the real migration CLI with **no pending migrations**,
started published alpha.25, verified health, and durably completed at **22:39:07 UTC**, exit 0,
`recoveryRequired:false`, with its lock removed by the worker. Database schema and all 28 migration
history records are unchanged. No manual lock deletion, SQL replay or second update was performed.

However, the restarted backend incorrectly reported **FAILED: Update interrupted during starting
phase**. As the actual `smart-panel` user, `existsSync(attempt.json)` returns false and reading it
returns `EACCES`: the root worker creates a 0700 root directory and 0600 root record. A signal-0
probe of a live root process also returns `EPERM`, which the observer treated as process death.
Thus the worker execution succeeded, but **end-to-end System status acceptance remains open**.

The follow-up passes the backend's own numeric group to the worker through its internal launch
environment. Only attempt metadata becomes group-readable (directory 0710, atomic record 0640);
writer ownership, the 0700 lock and private migration logs remain unchanged. `EPERM` keeps a live
privileged owner observable. Operator invocations without an observer group keep owner-only modes.
A real root/service-user fixture executes production writer functions and the compiled observer:
private metadata reproduces FAILED; readable metadata with the old PID probe reproduces FAILED;
both corrections together produce COMPLETE without blocking initialization. It also rejects
service-user writes to the record and reads of the lock/private migration log. These are disposable
fixture results, not a second staging upgrade or deployment of the follow-up.

## Current release and upgrade result — 2026-09-27

PR [#1120](https://github.com/FastyBird/smart-panel/pull/1120) was squash-merged as
`7ff77089031d24c5b820d7579759470ba8335e10`. The authorized
[Alpha Release run](https://github.com/FastyBird/smart-panel/actions/runs/36348182816)
published `1.1.0-alpha.24`; its tag points to version-sync commit
`35619a082483aca59fab02e1c0381c9964fcf3ff`. The ARM64 server archive SHA-256 is
`4bac9ecd21904078ee6b5cd83342f7683c8cf439c6785fb5d1815f0350c9718d`.
Its worker matches the installed review worker and repository source byte-for-byte
(`b09055998997d374d86f523921b655ee64f7ec9d32e2de48c271b9d3c7f33b7c`).

The private review deployment had omitted `.image-install`. Restoring that marker corrected
installation detection without product changes. The ordinary authenticated System API then offered
alpha.24 and accepted one install request at **20:59:02 UTC**. At **20:59:56 UTC** the worker held
in `recovery_required/stopping`, `migrationEntered:false`, because quiescence did not settle.
The original binary remained selected. The failed attempt, status and journals were archived;
its lock was preserved. The unchanged original installation was restarted and verified healthy
with 111 devices and the designated source/alias online and OFF. This is a **failed normal upgrade**,
not installation or migration success.

A separate throwaway service on the same Linux/systemd host reproduced the launcher's circular wait:
`sudo systemd-run --scope` moved the worker into a scope but left its waiting sudo parent in the
backend's service cgroup. The worker therefore waited for a captured process that could exit only
when that worker finished. Removing the lock or exempting sudo by name would not repair this cause.

The repair adds an opt-in independent transient-service launch to `PrivilegedWorkerService`; only
`UpdateExecutorService` selects it. `--collect --service-type=exec` lets the sudo launcher return
without `--wait`. Existing worker quiescence, attempt ownership, deadlines, migration and health
checks are unchanged. The initial status replay also retains a readable starting message instead
of exposing `undefined` as a phase. Confirmed service settlement without a terminal status fails
promptly; ambiguous probes retain the reservation, and a concurrent terminal file wins over the
settlement fallback.

Validation: **221 tests / 5 suites** pass across privileged workers, executor, updater service,
worker script and update CLI; backend build passes. The new
`test/support/update-launcher-systemd.integration.sh` executes the actual compiled launcher and
unchanged worker predicates: scope control returns busy (`1`), independent-service case returns
quiescent (`0`) under real `KillMode=process`. A third case confirms that an early worker exit is
reported without waiting for the job timeout. Every case explicitly fails if its worker remains
active. The fixture has no application database or device I/O.
This proves the launcher correction, not a repaired live upgrade. The failed staging hold still
requires an evidence-preserving recovery/deployment step after review; alpha.24 alone cannot replace
its own installed launcher. Full latency and client acceptance remain open.

## Recommendation

Keep the command-window convergence semantics. Restore the intended separation between the SQLite metadata catalog and the memory/InfluxDB value path before collecting acceptance timings. Separate three deliverables: responsive and truthful controls, a reproducible staging installation, and a repeatable normal System-module upgrade. Give release/CI work its own completion criteria.

**Owner clarification, 2026-09-27:** The existing Raspberry Pi is staging and may be overwritten as needed. A second SD card/RPi is therefore not required. Preserve the useful failure evidence and representative configuration, then rebuild this staging installation directly from the verified candidate. Repairing the old installation in place is no longer on the critical path. Backend integration and updater compatibility tests can also run on disposable infrastructure. Fresh-install results remain separate from upgrade acceptance and require representative load before qualifying as performance evidence.

This document proposes a replacement execution plan incorporating the owner's authorization to overwrite staging. It does not change existing timing limits or weaken the updater's safety contracts for installations upgraded in place. Record the staging-reset decision in the issue ledger when implementing the plan; the old private recovery packet is no longer a prerequisite for this reset. The new issue organization and diagnostic lifecycle described below remain proposals. The implementation and validation history is recorded below; the current release and failed normal-upgrade result above supersede the initial documentation-only inventory.

## What the evidence establishes

| Finding | Evidence and qualification |
| --- | --- |
| Original flicker had a backend cause | [#1006](https://github.com/FastyBird/smart-panel/issues/1006), using [#1007](https://github.com/FastyBird/smart-panel/issues/1007), records Shelly notifications arriving within 30–90 ms of RPC, then waiting behind 54/102 other property updates. A previous tap's confirmation arrived after the next tap. These are historical observations, not new measurements. |
| The old write path amplified polling bursts | The original investigation found process-wide exclusive serialization and repeated entity/value loads. Current `ChannelsPropertiesService.updateValueOnly()` instead uses shared structural admission, per-property coordination, one entity load, and minimal producer DTOs. Structural changes retain exclusive protection. |
| Core fixes are present | Canonical source command windows, previous-command carry-forward, generation-scoped failure handling, stale-report suppression, PATCH compensation, HomeKit pending cache, and Shelly poll coalescing/fencing exist in the reviewed tree. The related issues being closed is not the sole basis for this finding. |
| Hardware acceptance remains incomplete | [#1032](https://github.com/FastyBird/smart-panel/issues/1032) still lacks the comparable 20 idle + 20 actual-overlap matrix and full client/recovery evidence. Its three isolated alpha.11 server spans are not a statistical result; the separate 4347.625 ms restoration remains unresolved against its applicable budget. |
| Some later failures belong to measurement tools | [#1052](https://github.com/FastyBird/smart-panel/issues/1052) distinguishes a ValueState/boolean parser defect, false-valued baseline rejection, missing exports/correlation, and collector defects. These do not retrospectively explain the original uncorrelated timeout. Its original cause is recorded as irrecoverably underdetermined. |
| Updater failure is a separate lifecycle problem | [#1093](https://github.com/FastyBird/smart-panel/issues/1093) records the TypeORM transaction-mode incompatibility, old-worker execution, stop/quiescence failures, startup/health deadlock and recovery holds. Command-window changes are not established as their cause. |
| Current deployment blocker is narrower than the issue history | The latest #1093 description and [re-review](https://github.com/FastyBird/smart-panel/issues/1093#issuecomment-5840370271) identify two private recovery-tool defects: inexact cgroup membership and late verification of original lock identity. Alpha.23 publication and isolated published-byte replay are already recorded as passing. |
| Live staging was rebuilt during this review | The original alpha.18 installation and its failed updater metadata were archived. The original review candidate was `1.1.0-alpha.23+review.212840af2`; staging now runs `1.1.0-alpha.23+review.002aa2e4f` with preserved database/configuration/pairing and a fresh runtime directory. This is maintenance deployment, not ordinary updater acceptance. |
| CI and release issues have different outcomes | [#1040](https://github.com/FastyBird/smart-panel/issues/1040)/[#1045](https://github.com/FastyBird/smart-panel/issues/1045) own CI stability and recounting. [#1110](https://github.com/FastyBird/smart-panel/issues/1110) owns npm visibility/release reconciliation; its comments record successful alpha.22 artifact reconciliation and separate Docker recovery under closed #1114. Neither proves device installation. |

## Why the work stopped converging

1. **Implementation, instrumentation, installation and product acceptance became one serial chain.** A problem in a diagnostic launcher or the old installer prevented evaluating already-merged control fixes.
2. **The test infrastructure accumulated its own defects.** Private parsers, launchers, selectors, recovery packets and cleanup code required repeated repair. Passing source-function checks did not prove the real caller, SSH, systemd and service-user boundaries.
3. **A release cannot repair the worker that is already running.** The System executor launches its installed `dist/.../update-worker.sh`. Publishing a fixed target does not replace that old launcher for the first upgrade. This explains the need to distinguish one-time legacy recovery from ordinary subsequent updates.
4. **The diagnostic start conditions can make the test impossible.** #1033/#1077 retain a run where the target appeared after 260.951 seconds and a required later slot fell at 364.951 seconds, beyond the 360-second placement session. Repeating that startup sequence or extending product TTLs does not answer the latency question.
5. **Evidence ownership is too repetitive.** Long current/historical instructions across #1006/#1033/#1032/#1052/#1093 obscure which failures are unresolved, which are already classified, and which results can be reused.

The safety checks are not the underlying problem. They found real faults. The remedy is a smaller reproducible workflow and separate exit criteria, rather than removing ownership, database, or health checks.

## Product contracts to preserve

- Platform acceptance, device confirmation, and the displayed optimistic value are different facts. An accepted command alone does not confirm hardware state.
- Source and virtual aliases share one command generation. An earlier command's completion or failure cannot undo a later command, including A→B→A.
- Suppressed stale reports do not enter accepted current state, history, or client broadcasts. Failure/expiry reconciles through the existing guarded path.
- The current 1500 ms confirmation grace and platform TTLs are bounded heuristics. For a boolean, an old `false` report and a genuine external `false` change can be indistinguishable without causal provider metadata. Test and document delayed reconciliation; do not promise perfect causal classification.
- Keep Homey's authoritative-readback behavior and all existing permission, lifecycle and persistence boundaries.
- Preserve the approved server span limits: p95 <800 ms and every sample <3000 ms, with 20 idle and 20 actual-poll-overlap samples, zero timeouts and the existing 5000 ms client convergence bound. Do not mix clocks or label an absent event as a measured duration.
- Also report command acknowledgement, provider receipt, source publication, client receipt and visible/physical response separately. The server write span excludes time before `update()` and cannot alone establish that a tap feels fast. Before final sampling, record an explicit user-facing latency target; the 5000 ms failure bound must not become the UX goal by accident.

## Work packages and exit criteria

### P0 — One current inventory and a frozen candidate

**Owner:** #1033; evidence index in #1032.

- [x] Read the named issues, relevant linked follow-ups, current handoffs and source boundaries; verify local revision against GitHub main.
- [x] Separate established failures, retained historical uncertainty, implemented fixes and missing acceptance evidence.
- [ ] Replace repeated next-step prose with one short status table: work package, candidate version/hash, next action, evidence link, exit criterion.
- [x] Pin alpha.23 as the initial candidate because its publication/replay already passed; change it only for a demonstrated defect. Keep the existing installation's exact state as a separate inventory.
- [x] Confirm the hardware disposition: the existing Raspberry Pi is overwriteable staging; use it sequentially for clean-install and upgrade scenarios.
- [ ] Record the UX latency target and representative device/load configuration before collecting final results.

**Exit:** One reproducible candidate and three explicit outcomes: property behavior, repeatable staging setup, normal upgrade. Missing original historical measurements stay marked missing.

### P1 — Verify the complete property path without waiting for recovery

**Owner:** #1032, with focused fixes only for reproduced product defects.

Use the existing convergence and owning component suites. The current `property-command-convergence.integration.spec.ts` combines real command/window/property/projection/HAP components but substitutes storage/repositories and platform behavior. It is useful coverage, not proof of a complete authenticated route with real SQLite.

- [ ] Map existing tests to the cases below and add only missing integration coverage using real disposable SQLite and controlled provider I/O.
- [x] Exercise the real HomeKit dispatcher, virtual forwarding, SQLite catalog/leases, property-value service, production memory-storage fallback and HAP notifications together; cover rapid ON/OFF/ON, refusal, provider exception, older failure after newer confirmation and unchanged-report reconciliation.
- [ ] Exercise direct source and virtual aliases through actual command entry points; include REST PATCH and rejected/unauthorized input. Verify REST state, WebSocket events, HAP cache/notifications and source history together.
- [ ] Cover delayed previous-command readback, confirmation followed by stale readback, A→B→A, repeated same-value commands, two aliases, rejected dispatch, missing confirmation, external change, expiry and structural deletion/remap.
- [ ] Drive real Shelly poll admission/drain and notification fencing with deterministic interleavings. Confirm writes to another property can proceed while one is held and that deletions cannot recreate orphan history.
- [ ] Run the collector/observer on the same fixture, including false values, invalid/missing acknowledgement, timeout, export failure and restoration correlation. A diagnostic failure must be distinguishable from a product failure.

**Exit:** One repeatable command produces an integrated report with no stale accepted event and correct failure reconciliation. All identified product regressions have focused tests. This work requires neither release publication nor a live updater operation.

#### P1 local result — 2026-09-27

The initial targeted baseline passed **123 tests / 8 suites** after installing the locked backend dependencies, building the extension SDK and generating the backend specs with the existing generator.

The new `apps/backend/src/plugins/devices-homekit/services/homekit-command-convergence.integration.spec.ts` exposed an independently reproduced residual defect: after an accepted ON command, an unchanged OFF provider report was held; on expiry, backend state stayed correctly OFF but HomeKit stayed optimistically ON. Recovery deduplicated the stored value and therefore emitted no event to the virtual aliases. A fresh report superseding the recovery had the same problem, including the metadata-update path.

The focused repair publishes the accepted reconciliation state once even when unchanged, while retaining history deduplication and generation fencing. Tests reproduce the failure before the repair and pass afterward. The new suite contains **11 cases**, uses real production entities/services and observes HAP `change` events, with only the physical provider controlled. It does not advertise a HomeKit bridge or claim HTTP/WS transport, migration, InfluxDB durability or real-device latency coverage.

Final targeted validation: **433 tests / 33 suites passed**, covering the command/value/coordinator/structure services, all HomeKit suites, virtual forwarding/projection and Shelly delegate tests. Backend type-check, focused ESLint and Prettier checks passed. The architecture document now describes unchanged-value reconciliation notifications. No dependency, schema, public API, TTL or grace-period change was introduced.

A subsequent concurrency check reproduced a second defect: HAP published an older successful SET value after a newer command/report had won. The same issue produced a transient stale event in the thermostat coordinator, hidden by its next-tick refresh. Writable mappings now use HAP write responses with the current mapped value, and accepted backend value events supersede pending HomeKit state (metadata-only events retain their stale-cache guard). Coverage includes same-characteristic and cross-alias late success, and expiry before provider acknowledgement. This adds HAP write-response capability to writable characteristics; actual Apple Home interoperability is still a staging acceptance gate.

Reproduce the added integration coverage:

```sh
pnpm --filter @fastybird/smart-panel-backend exec jest --runInBand src/plugins/devices-homekit/services/homekit-command-convergence.integration.spec.ts
```

Existing separate suites cover permissions/command admission, PATCH compensation, canonical mapping, structural exclusion and poll cancellation. Their combined passing result is not full transport-level acceptance. Remaining P1 work includes the authenticated REST/WS integration boundary and the diagnostic-runner failure matrix. This result does not reclassify #1052's lost historical cause or complete the Raspberry Pi/client matrix. The staging candidate must include this repair after review/build; the unchanged published alpha.23 does not contain it.

### P2 — Preserve useful evidence and rebuild staging

**Owner:** #1033 coordinates the reset; #1093 retains updater failure evidence and compatibility scope. The owner has authorized overwriting this staging installation. An in-place reconciliation of its held alpha.19 attempt is not required to prepare a fresh installation.

- [ ] Identify the exact staging host/storage and capture version, installed worker, attempt/lock/status, relevant journals, service configuration and device/source/projection topology. Keep credentials and pairing material private.
- [ ] Retain a consistent database snapshot or stopped/offline image for reproducing the old failure, plus configuration needed to restore representative load. A normal stop/offline capture belongs to the authorized reset; it does not require running the private metadata-reconciliation packet. If a snapshot cannot be obtained, record that limitation without turning missing historical evidence into a passing result.
- [ ] Install the verified alpha.23 candidate directly using the supported image/installation route. Keep the failed installation's updater metadata in the evidence archive; do not import its attempt/lock into the new runtime or label the old attempt successfully reconciled.
- [ ] Restore/recreate representative device configuration and the source→virtual→HomeKit topology. Handle Apple Home pairing through the supported path and record any changed identity. Separate initial onboarding/discovery from warm-state measurements.
- [ ] Verify artifact/runtime version, migrations, health, device-handler readiness and access. Retain a reproducible setup checklist and clean baseline snapshot for subsequent upgrade scenarios.
- [ ] Defer the two private recovery-packet corrections unless an explicit in-place legacy-recovery support case requires that tool. Its known defects remain documented, and the packet must not be executed while unresolved. Ordinary updater failure/ownership regression coverage remains required in P3.

**Exit:** The Raspberry Pi has a verified, reproducible staging installation with representative configuration and archived old failure evidence. This is a clean-install result, not proof of a repaired legacy upgrade or recovery procedure.

#### P2 execution inventory — 2026-09-27

A live SSH inventory confirmed alpha.18 active/healthy, image installation, `KillMode=process`, and the existing alpha.19 `recovery_required/stopping` attempt with `migrationEntered=false`. Public status separately records a failed alpha.20 attempt; these are retained as distinct records. A private archive contains a consistent SQLite online backup (integrity check `ok`), device/configuration and HomeKit pairing files, updater status/attempt, installed worker/hash, service configuration and recent journal. Local and remote archive SHA-256 match. Credentials and the archive remain outside the repository.

Production fixes are committed at `694525432`; the systemd fixture correction is committed at `212840af2`. The local backend build succeeds. The published alpha.23 ARM64 server archive has been downloaded and verified against its published SHA-256. The staging candidate combines that runtime/dependency/admin/display baseline with the locally verified backend build and a distinct build identity. It is an unpublished staging candidate, not a new public release. Identity: `1.1.0-alpha.23+review.212840af2`, artifact SHA-256 `4bcbe0d33936aafde4fa9854a8c3fed6b5524ecd1f1caebd749416f6ed844c50`. Its actual ARM64 dependencies, local compiled backend and a copy of the staging database passed migration CLI (`No migrations are pending`) and health startup on disposable Linux using default configuration.

A first maintenance deployment preserved the complete old working directory and restored its database/config/pairing into a fresh runtime directory, excluding old updater status/attempts. This is a binary/runtime rebuild with preserved application data, not an empty-database install or a normal updater success. The candidate did not become healthy within the initial 45-second deployment check, so the deployment restored the untouched alpha.18 directory and data. Alpha.18 then took 79 seconds to reach Nest application readiness. The second diagnostic deployment succeeded using a separate 300-second cold-start observation budget; product/worker timing limits were unchanged. The application became healthy after approximately 103 seconds; its managed-service bootstrap waited approximately 102 seconds, with WLED finishing last after approximately 95 seconds. This identifies a startup dependency boundary, not yet the internal cause of all WLED time. The startup-hook override was subsequently removed. A further restart without that override took approximately 60 seconds. All 111 catalog devices and the existing Apple Home pairing were preserved, and the selected Shelly source eventually became online. Physical command/restore cycles were then executed as recorded below.

### P2a — Restore the value-path boundary (new evidence, 2026-09-27)

**Owner clarification:** SQLite is the structural catalog. Property values belong in memory or InfluxDB; ordinary value reports must not start ORM work or mutate SQLite.

The first live candidate (`212840af2`) wrote `devices_module_property_value_locks` for each property operation, including unchanged reports. `PropertyValueLockService` creates a Unix socket and performs SQLite INSERT/SELECT/DELETE operations around the value store. Git history locates its introduction in `23d4accba`, Homey adoption **#816**, to serialize terminal reconciliation against writers in independent backend processes. This cost was added to the common value service and affects every provider. `ChannelsPropertiesService.updateValueOnly()` separately loads property/channel/device metadata using an ORM query for every value update.

A small isolated storage benchmark on staging measured a median **38.84 ms** per INSERT/two SELECTs/DELETE with SQLite DELETE/FULL (25 iterations; max 98.82 ms). WAL/FULL still cost 35.40 ms median. These are scratch-database measurements under live load, not property latency samples or proof that WAL solves the issue. A short vmstat observation showed 12–20% I/O wait. Do not change SQLite durability to hide this overhead.

An initial optimization in `dde47d550` skips durable leases only for unchanged values while retaining local ordering. It passed **610 tests / 51 suites**, type checking, lint and build, but was **not deployed and has been superseded by the optional-lock configuration**. The owner clarification exposed its insufficient scope. Its candidate overlay is retained privately and must not be described as running on staging.

- [x] Confirm runtime ownership: the owner specifies one backend process per installation, including smaller Raspberry Pi models. Preserve cross-process property leases as an optional startup setting, disabled by default: `FB_PROPERTY_VALUE_LOCKS_ENABLED=false`. All writers must enable it for cross-process coordination; changing modes requires restart. The ordinary in-process keyed queue remains active in both modes.
- [x] Remove SQLite lease operations from ordinary value updates, including changed values. Preserve same-property ordering, reconciliation comparison/write atomicity, failure handling and deletion safety through the agreed runtime ownership model.
- [x] Supply value updates with a maintained in-memory metadata snapshot. Handle startup, creation, metadata changes, channel/device changes, source remaps and deletion with explicit invalidation/ordering. Do not trust an indefinitely cached provider entity or silently recreate removed properties.
- [ ] Retain a regression that counts database/ORM operations across a fully initialized ordinary source→alias value update and requires **zero** catalog queries and mutations. Cover changed and unchanged reports, event fan-out, deletion/remapping and concurrent adoption.
Local verification of the single-process change: **635 tests / 53 suites** covering Devices services and HomeKit, plus **921 tests / 56 suites** covering Homey, virtual devices and the updated real-SQLite/HAP fixture (the batches overlap; do not sum them). Both lease modes pass the convergence fixture. The default mode executes **zero SQLite queries** for changed/unchanged source reports and alias/HAP publication after metadata initialization. Real SQLite tests cover creation, property/channel/device changes, source remaps, deletion and rollback; focused tests cover in-flight invalidation, concurrent initial loads, load failure/retry and caller isolation. Type checking, lint and build pass. Full hardware acceptance and combined adoption/zero-query coverage remain separate obligations.

- [x] Re-measure representative startup and warm commands before changing lifecycle design: repeated metadata and lease I/O may also contribute to slow integration startup. Keep independently demonstrated lifecycle faults separate.

The default single-process candidate `002aa2e4f` is now deployed on staging. No migrations were pending. An initial private deployment attempt failed before migration/activation because the overlay archive imposed its local root-directory permissions; the script restored the previous binary, and the retry corrected ownership and checked imports as the service user before stopping anything. This was deployment-tooling failure, not an application migration failure.

**Authoritative staging readback, 2026-09-27 18:47:43–18:47:46 UTC:** [#1032](https://github.com/FastyBird/smart-panel/issues/1032) records the current deployment separately from its historical alpha.18 baseline. Read-only verification found systemd `active/running`, health `ok` with version `1.1.0-alpha.23+review.002aa2e4f`, the matching installed symlink, 111 authenticated catalog devices, and the designated source/alias reporting online and OFF with the expected mapping. Temporary startup/capture service overrides are absent. This verifies the maintenance-deployed candidate; normal System-module upgrade acceptance and the complete latency/client matrix remain open.

The new build reached health in **25 s**, then **21 s** after removing the temporary command-capture override. Its observed normal stop plus cgroup-quiescence check took **6 s**. The earlier build had also demonstrated a **90 s** stop timeout with SIGKILL; the last managed-service stop log concerned Zigbee2MQTT, with a separate Tailscale permission error before it. These observations warrant repeating the full lifecycle test, but do not identify the exact blocked await or independently prove that every lifecycle fault was caused by lease I/O.

**Exit:** values and metadata have separate operational paths, with explicit writer ownership and no SQLite/ORM work per ordinary value report. Convergence and adoption guarantees remain tested rather than removed implicitly.

### P3 — Prove the ordinary System-module upgrade

**Owner:** #1093, with a separately recorded acceptance result.

The success criterion is an upgrade requested through the normal authenticated System API/admin flow, using the worker shipped in the starting installation. A direct maintenance-script invocation is a different entry point.

- [ ] On disposable Linux/systemd first, test a legacy source→candidate transition and a repaired source→distinct next-version fixture transition. Record source worker and target artifact separately. Synthetic next-version artifacts are test evidence only. For legacy versions that cannot upgrade normally, explicitly document the supported maintenance/reinstall route and its data-preservation requirements; do not claim fresh-install success repairs that boundary.
- [ ] Exercise the actual installed executor/privileged-worker boundary, migrations, startup and health endpoint together, including the image unit's `KillMode=process` and Tailscale shutdown behavior.
- [ ] Reuse existing failure cases and close integration gaps: failed stop prevents SQL; migration failure retains recoverable state; late/wrong-version health cannot report completion; backend boot does not await its own health-dependent updater; duplicate request, restart and observer loss retain ownership.
- [ ] Verify public status/progress and actionable failure reporting after backend restart. A recovered historical failure stays failed; a new update has a new attempt identity.
- [ ] Verify a normal installed-device update from a repaired release to the next legitimate candidate before declaring routine upgrades restored. Do not publish a no-op release solely to produce a green checkbox; until such a target exists, report fixture success and live acceptance as separate states.

**Exit:** Normal upgrade succeeds without private worker replacement, manual lock deletion or database-history editing; interruption/failure leaves an explained and supported recovery state. Fresh-install success cannot close this deliverable. Legacy upgrade support and any remaining limitations have an explicit disposition.

#### P3 local verification — 2026-09-27

The updater executor/service/CLI/worker suites pass **150 tests / 4 suites**. The repository's real Linux/systemd test initially failed because its transient fixture disappeared from the manager after stop, its process start-time regex was overescaped, and the retained-child case required an empty manager result before checking the survivor. The fixture now uses a runtime-enabled unit, validates the actual start tick, accepts a nonempty enumeration only for the deliberately unsafe case, and cleans up on failures. Both `KillMode=control-group` (empty/removed cgroup) and `KillMode=process` (surviving child rejected) passed on Linux ARM64/systemd 252 in an isolated disposable container. This proves the process/quiescence contract, not the full System API upgrade.

### P4 — Finish hardware latency and client acceptance

**Owner:** #1032. #1077 supplies diagnostics, not a substitute acceptance result.

**Environment:** The existing staging Raspberry Pi after P2, using the same source→virtual→HomeKit topology and representative load. Keep one authorized writer to the physical target during trials. A clean install with one lamp is a smoke test, not the original-load comparison. Run property acceptance first, save the verified baseline, then reuse the same hardware for upgrade scenarios. No second device or in-place recovery of the old installation is required.

- [ ] First prove ordinary startup, correct property mapping/handler readiness and one bounded command/restore cycle. Separate cold-start readiness from warm command latency.
- [ ] Validate the actual diagnostic runner end to end on the disposable fixture before physical samples. Retain the command request, acknowledgement, backend capture, client events and separate restore result in one evidence bundle.
- [ ] Make one command-free feasibility assessment of the existing #1077 placement session. If feasible, reuse it. If readiness consumes its useful window, propose one focused amendment: bounded diagnostic arming after the target is ready, with an independent readiness deadline and unchanged capture/product limits. This requires an explicit diagnostic lifecycle decision; it is not permission to extend or silently reset the existing session.
- [ ] Use scheduling forecasts only to place trials. Qualify overlap from actual joined poll/RPC/drain records. Preserve misses and failures; a miss is not an overlap pass, and failed trials are not replaced invisibly to obtain 20 green rows.
- [ ] Collect comparable 20 idle + 20 actual-overlap samples at normal logging/load. Retain current limits and explicitly disposition the historical 4347.625 ms restore. Before/after comparisons require comparable builds/configuration; never downgrade the repaired live database for a baseline.
- [ ] Observe Apple Home, admin and the unchanged panel: isolated and five rapid alternating taps across actual polling, rejected command, no confirmation, external change and recovery. Record visible behavior through settling/grace and correlate it with the backend; REST/WS alone cannot prove absence of UI flicker.
- [ ] Decide #1012 from a reproduced residual admin defect. Keep #1013 deferred unless unchanged-panel evidence demonstrates a remaining defect and activates that scope. The generic panel convergence method still clears on divergence; lighting-specific protections do not prove all device-detail screens correct.

**Exit:** Qualified timing matrix, physical/visible response, no stale flip-back, correct rejection/timeout reconciliation, all three client results, and restored target/configuration. Missing historic causality remains documented rather than reconstructed.

#### P4 live diagnostic results — 2026-09-27

On `1.1.0-alpha.23+review.212840af2`, an initial authenticated WebSocket command reached source/alias events in approximately **1.02 s**, but restoration exceeded the unchanged **5 s** convergence bound. A later REST read confirmed the baseline OFF. That first private wrapper is exploratory evidence only; subsequent trials use the retained repository smoke runner and observer.

A correlated command/restore cycle then converged in **502 ms / 478 ms**. Its complete server captures measured **72.91 ms / 89.77 ms** from update entry to source publication. A later diagnostic attempt reproduced an acknowledgement timeout beyond **5 s**; restoration acknowledged after **4.40 s** and also missed the client convergence deadline. Its server capture shows **4.93 s** from update entry to source publication. Restoration was subsequently confirmed through REST. The failed command's server capture expired, so it does not provide a valid command pipeline sample. Successful later runs do not replace these failures. Scenario labels in the exploratory wrapper are provisional; no idle/overlap acceptance count is claimed.

The real Apple Home app on the Mac contains the paired target. Isolated ON/OFF cycles reached matching backend states and ended at baseline OFF. Desktop video attempts were unsuitable (one ended with its short-lived CLI session; another recorded the foreground display while Home was covered). Those cannot establish visual convergence. A subsequent exact-window capture retained **201 frames over 55.36 s**, with a maximum request gap of **0.691 s**. Sampled tile backgrounds showed only OFF→ON→OFF; short flicker between frames and the rapid alternating-tap matrix remain unverified. A video assembled from these frames preserves their observation timing and remains private with the original frames and backend events.

No 20+20 acceptance matrix, normal System upgrade, admin UI or panel UI acceptance is claimed. Temporary capture and startup overrides were removed after evidence retention, followed by a normal service restart.

#### P4 single-process candidate — 2026-09-27

On `1.1.0-alpha.23+review.002aa2e4f`, a readiness preflight initially rejected the still-offline target without sending a command. After source and alias both became online with the same OFF baseline, three authenticated WebSocket command/restore cycles completed. All six operations had complete, request-correlated server captures and passed the unchanged 5 s client bound:

| Cycle | Command client convergence | Restore client convergence | Command / restore update→publication |
| --- | ---: | ---: | ---: |
| 1 | 359.5 ms | 471.4 ms | 129.3 / 161.4 ms |
| 2 | 1067.5 ms | 303.8 ms | 15.3 / 7.5 ms |
| 3 | 760.9 ms | 592.8 ms | 65.9 / 13.7 ms |

Acknowledgement times ranged from 187.0 to 580.6 ms. Every cycle independently confirmed restoration to OFF. These are exploratory samples under the existing 111-device configuration, with unqualified idle/overlap labels; they are not the required 20+20 matrix or new Apple Home visual evidence. Retain all earlier failures alongside these samples. The scoped capture override was removed and a normal service restart passed health. The normal System API upgrade remains untested.

#### P4 bounded preparation decision — 2026-09-28

The alpha.26 command-free placement attempt retained target decisions but no stable adjacent pair:
connected delegate counts grew 7 → 26 → 46 → 49 → 51 and every adjacent order fingerprint changed.
The fifth target slot fell beyond the constructor-armed 360-second limit. There were zero device
commands and zero qualified latency samples. This negative result does not change earlier failures.

The user approved a separate opt-in preparation lifecycle: at most ten minutes from observer creation,
then one active window of at most 360 seconds after two qualifying actual adjacent cycles. Schema v2
retains preparation observations and separate creation/activation timestamps; v1 stays compatible.
The implementation and local service/export/reader/selector/finalizer tests belong to the existing
#1032/#1077 work. They do not establish live feasibility or command/RPC overlap.

- [x] Add the bounded opt-in lifecycle and reviewable private adapter conformance tests.
- [x] Review/release the candidate and complete one fresh command-free staging placement gate.
- [ ] Complete the original physical/client acceptance with independently qualified captures.

PR #1123 was merged as `bd6a30dab2188e04412466380fa9e91d4dc9e899`; it restores visible STARTING
progress during observation, verified in the normal alpha.26 → alpha.27 staging upgrade. Its review separately recommends
binding in-memory update-lock release to the acquiring attempt so late settlement cannot release a
successor's lock. Retain that hardening item for the updater path; it is outside this diagnostic PR.

#### P4 bounded placement gate — 2026-09-28

PR #1124 shipped in the alpha.27 server package. The normal System API upgrade from alpha.26
completed with STARTING → COMPLETE, preserved all 111 device identities and migration history,
and left no updater lock. Raspberry image jobs were still running when this result was recorded.

One command-free schema-v2 session activated after 419.477 seconds, on actual cycles 6/7.
The first local caller omitted Node from PATH; the unchanged session and active deadline were
retained while correcting that caller. The actual reader/selector then selected cycles 8/9 with
the next target slot 55.859 seconds ahead. Original failed reads and the corrected positive read
remain separate evidence. The final export/owner were archived, the writer stopped, the owned
files and override removed, and normal alpha.27 health and source/alias OFF verified. There were
zero device commands and zero latency samples; the 20+20 and client acceptance remain open.

An offline negative replay exposed a separate private-selector gap: a decision 21.764 seconds
ahead of the validated current time was accepted. The focused adapter repair rejects future
cycle/registration/decision observations conservatively and checks UTC against the paired clock
anchor. The actual publisher/reader/selector suite passes 23 tests; the retained positive staging
read still selects, and the negative replay now rejects with `decision-in-future`. Review this
repair before command batches. It changes local diagnostic tools, not the deployed runtime.

### P5 — Close the independent follow-ups and retire temporary machinery

- [ ] **#1110:** Verify its recorded npm/server/image/Docker reconciliation against its own scope and close it if complete. Keep the failed original workflow history; later success does not rewrite it. Do not make it wait for hardware latency.
- [ ] **#1040/#1045:** Complete the specified CI-run recount and reporter disposition independently. Normal per-change CI remains required everywhere.
- [ ] **#1052:** Propose making it the closed historical incident once its existing remaining acceptance checkboxes have an explicit owner in #1032. If that scope amendment is not adopted, leave it open until those criteria pass. Do not call the original cause fixed or known.
- [ ] **#1077:** Close when the chosen bounded diagnostic method and cleanup are demonstrated; retain only useful regression coverage and remove/deactivate temporary runtime configuration after measurement.
- [ ] **#1093:** Amend its execution scope to record the authorized staging rebuild and remove that installation's private recovery packet from the critical path. Close after normal-upgrade acceptance and an explicit legacy compatibility/recovery disposition; never mark the archived failed attempt as a successful recovery.
- [ ] **#1006/#1033:** Close only after property/client acceptance, relevant recovery results and explicit #1012/#1013 dispositions are linked. One merged PR or published release is not completion.

## Execution order

```text
P0 candidate/inventory
  ├── P1 deterministic property-path verification
  ├── P2 archive old evidence → rebuild the existing staging Raspberry Pi
  └── P3 disposable normal-upgrade compatibility verification

P1 + P2 ───────────────────────────────────────────→ P4 physical/client acceptance
P4 + saved staging baseline + next legitimate target → P3 normal live-upgrade acceptance

P5 CI/release bookkeeping has its own evidence and does not block unrelated offline work.
Private legacy recovery-packet repair is conditional support work, not a prerequisite for P2/P4.
All required product and updater results → final closure.
```

These are dependency boundaries, not a request to run multiple agents or concurrent physical writers. A single implementer can advance independent offline work while another work package awaits hardware, review or a release target.

For every new failure, record: exact trigger, expected/actual behavior, which boundary failed, one owning issue, smallest correction and one regression. Reuse that issue for subsequent corrections. Create a new architecture issue only when a real contract decision is needed. Reuse valid evidence unless changed bytes, environment assumptions or a concrete failure invalidate it.

## Source anchors and assessment limits

Reviewed source boundaries:

- `apps/backend/src/modules/devices/services/{channels.properties,property-command-window,property-command-dispatch,property-command,property-value}.service.ts`
- `apps/backend/src/plugins/devices-homekit/mappers/base.mapper.ts` and `listeners/homekit-event.listener.ts`
- `apps/backend/src/plugins/devices-shelly-ng/delegates/delegates-manager.service.ts` and `services/poll-placement-diagnostics.service.ts`
- `apps/backend/src/modules/system/services/update-executor.service.ts`, `scripts/update-worker.sh`, and their tests
- `apps/backend/src/dataSource.ts`, `app.module.ts`, migration-26 test coverage, and `test/support/update-worker-systemd.integration.sh`
- Tailscale managed-service shutdown, admin `useDeviceControl.ts`, panel `device_control_state.service.dart`, and `.github/workflows/ci-tests.yaml`
- `docs/optimistic-ui-architecture.md`, `docs/property-command-latency-runbook.md`, and the image update runbook in `docs/remote-access-architecture.md`

GitHub issue bodies/comments and source were inspected. Private recovery-packet outcomes remain attributed to issue records. Live SSH inventory, a consistent database archive, published artifact hash verification, disposable migration/health checks and the limited physical diagnostics above were subsequently performed. The later alpha.24 release and failed ordinary System upgrade are recorded in the current-result section above. The initial assessment was documentation-only; dependencies were subsequently prepared and the targeted backend verification recorded under P1 was executed. Full hardware latency and client acceptance remain outstanding; actual Apple Home smoke observations and their sampling limits are recorded above.
