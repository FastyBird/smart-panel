# Space activity modes

The home-control plugin provides Work, Relax, Sleep, Entertainment and Away for rooms and zones.
These modes are independent of last-interaction tracking and media activities. Climate and security are disabled in authored defaults. Explicitly configured climate actions use the governed activity bridge merged in #1498. Startup never replays an activation; custom mode authoring, presence triggers and security actuation remain separate. Time schedules reuse the same activation service. Admin and Panel use the same saved configuration and persisted selection contract.

## API

All routes are under `/api/v1/modules/spaces/spaces/{id}/activity-modes` and return the standard `data` envelope.

- `GET /`: enabled modes in per-space display order.
- `GET /{mode}/config`: persisted configuration, including disabled modes.
- `PUT /{mode}/config`: full replacement with `data.expected_revision`, `enabled`, `display_order` and `configuration`.
- `POST /{mode}/config/reset`: copy authored defaults with `data.expected_revision`.
- `GET /active`: persisted selection/request result, or null before first activation.
- `POST /{mode}/preview`: readiness only, with `data.expected_revision`; no commands, writes or events.
- `POST /{mode}/activate`: manual activation with `data.expected_revision`.
- `POST /deactivate`: clear selection with `data.activation_id`; no implicit device rollback.

Configuration writes require owner/admin roles. Manual activation/deactivation uses the existing space
WebSocket policy: an authenticated display token or owner/admin user. The server derives the initiating actor;
requests never accept source, actor, owner tokens or automation bypasses. UUID paths, enum modes, nested
validation and compare-and-swap revisions/identities reject malformed or stale requests.

Migration 46 adds activity configuration and active-state discriminators to unified space-role STI storage.
Each configuration has a non-null space ID; defaults are copied for existing/new rooms and zones. GET is read-only.
Configuration changes and resets increment revision. Moving out of a supported space type removes activity rows;
returning creates fresh defaults. Space deletion cascades. Other role kinds remain unchanged.

## Execution and results

Lighting calls the existing mode plan and preserves its role exclusions. Brightness overrides apply only to
roles already selected ON; zero switches those roles OFF. Sleep and Away use actual whole-space OFF. Covers use
absolute positions through the existing intent service. Activity admission follows its position-first route: a present
position property must be writable, canonically valid and able to represent the exact requested value without
clamping or changing its step/grid. Only an absent position property permits the command-only endpoint route. Command-only intermediate positions, read-only controls
and group percentages without supported semantics report unsupported; no percentage-to-open guess is made.
If any selected cover cannot honor the request, the covers domain is conservatively refused as a whole.
Media Background and other activation activities use an operator-created binding and the existing media preview/execution plan. OFF uses read-only deactivation admission and the existing deactivation action to pause resolved playback and clear media selection; it requires no OFF binding. Missing activation bindings, empty
plans or diagnostics report unsupported. Preview never manufactures media bindings.

Every domain reports `disabled`, `no_targets`, `unsupported`, `failed` or `succeeded`; preview uses `ready`.
A domain's failure does not prevent the other domains from running. Failed/offline targets make its result failed,
even if some commands applied. Repeating an already active media activity preserves its persisted failed-step summary;
it does not turn a prior noncritical failure into a fresh success or replay the media plan. The selected mode remains
persisted with active/partial/failed status. These results
represent command execution, not independent physical acknowledgement or whole-room state convergence.

Overlapping activation requests for a space receive conflict; there is no deferred physical plan queue.
Configuration revision and activation identity fence completion. Deactivation clears selection and changes identity.
Later lighting dispatches, cover writes and media steps check the internal identity before sending. Work already
admitted to an existing domain/provider can finish; clearing a selection does not retract commands or invent undo.
A crash leaves an honest interrupted status on restart and never replays an old activation.

`SpacesModule.ActivityMode.ConfigChanged` and `SpacesModule.ActivityMode.StateChanged` are committed refresh hints,
forwarded through the existing WebSocket event bus. Refetch HTTP state. Activation hints include `space_id`,
`activation_id` and `configuration_revision`; configuration hints include space, mode and revision. Hints are not
actuator acknowledgements.

## Climate and security boundary

Climate defaults have no preset, mode or numeric temperature. Explicit enabled climate configuration requires a
preset reference or an explicit heat/cool numeric setpoint/delta. Presets cannot mix with mode/numeric settings;
absolute setpoint and delta are mutually exclusive. For virtual thermostat targets, the trusted climate adapter validates preset existence, ranges and deadband during write-free preview and activation. Numeric physical targets do not receive target-specific range or deadband validation during preview and can still report `READY`; activation clamps numeric setpoints to the current supported ranges. Missing providers and incompatible targets return explicit unavailable/unsupported outcomes. Configuration persistence alone does not claim target availability.

Virtual thermostat activation requires explicit automation opt-in and a valid current source/controller/slot group. Existing manual holds, explicit OFF, temporary overrides and protective qualification keep precedence. Deactivation or source changes withdraw only the original owned installation; they cannot adopt legacy actor-tagged JSON or retire a successor. The guarded runtime and physical intent paths retain their original command and observation contracts.

Settled unchanged groups can renew after unrelated graph validation. An activation still waiting for original runtime completion can fail and retire if graph authority changes; it is not retried under newer authority. See [climate architecture](climate-architecture.md#activity-climate-automation) for the bounded source/slot/effect contracts. Time schedules reuse this bridge; occupancy integration remains #1458 work.

Enabled security reports unsupported because current security services expose status/acknowledgement, not arm/disarm.

## Admin configuration

The space detail Domains tab includes Activity modes for all five built-ins, including disabled modes.
Open Edit to enable or disable a mode, change its display order, and configure each domain. Lower display-order
numbers appear first; each mode is saved independently, so changing several orders is not an atomic reorder.
Reset to defaults is an explicit revision-checked write. Climate defaults remain disabled and unset. Enabling climate
requires an explicit Comfort/Eco/Away preset or a heat/cool temperature target or delta; Work never chooses a preset
implicitly. Climate settings use target-specific readiness and explicit provider guidance; unsupported security actuation remains visible.

Preview saved settings checks the saved revision only. Editing any field invalidates the preview and disables it until
saved. It never saves the draft, creates a media binding or controls a device. Preview shows readiness per domain,
including disabled domains, missing devices and unsupported configurations. A conflicting save/reset refreshes saved
truth and leaves the draft visible. Discard draft explicitly loads the latest saved settings before editing again;
there is no hidden overwrite or automatic retry.

## Panel selection

Room overview places enabled modes above its domain sections, with localized names, icons and saved display order.
Tap a mode to submit its saved revision once. Tap the selected mode or Manual to clear the exact current activation
identity. Clearing does not restore earlier device values. A loading indicator represents a pending request; a saved
selection and its active/partial/failed/interrupted status describe command outcomes, not physical convergence.
Details show per-domain outcomes. With no saved selection the panel shows Manual; with no enabled modes it hides the
section. An unconfirmed response stays explicitly uncertain even when a read-only reconciliation finds server state.

Configuration/state events, device changes and reconnection refetch HTTP state only. Each mounted room page owns an independent read model. Space/request generations fence
late responses, and stale or busy controls cannot submit. Manual activation/deactivation bypass automatic network and
token-refresh replay, use no WebSocket actuation fallback, and never retry a conflict automatically. Scheduling,
presence, custom activity authoring, security actuation and hardware qualification remain separate work. Merged #1472/#1498 carry exact-head CI and completed reviews; final epic acceptance and alpha publication remain open. See [software acceptance](virtual-device-extensions-acceptance.md).

## Time schedules

Rooms and zones own one weekly schedule, initially disabled with no entries. The Admin's space configuration
page provides a seven-day editor, daily/weekday/weekend/custom day selections, entry enablement and an
optional IANA timezone override. A null override follows the configured house timezone. Entries select one of
the existing activity modes; they never infer thermostat presets or temperatures. Saving does not activate a mode.

Routes below `/api/v1/modules/spaces/spaces/{id}/schedules` use the normal authenticated `data` envelope:

- `GET /`: saved enablement, timezone, entries and configuration revision.
- `PUT /`: owner/admin full replacement with `expected_revision`, `enabled`, `timezone` and `entries`.
  Adding, editing and removing entries are one atomic configuration operation. A stale revision returns conflict.
- `GET /state`: read-only current/next planned occurrences, resolved timezone, scheduler availability,
  manual-precedence indication and last attempt. It does not replay an activation.

Each entry has a stable UUID, an explicit activity `mode`, local `HH:MM`, unique weekdays (`0` Sunday through
`6` Saturday) and `enabled`. The limit is 64 entries. Two enabled entries cannot occupy the same weekday/time.
The Admin preserves a conflicting draft and requires the user to review/discard it before saving against new truth.

The managed scheduler checks at UTC wall-minute boundaries. Entry calculations use the resolved local timezone,
independently of the server or Panel timezone. Missing spring times are skipped; repeated autumn times execute
only at their first real instant, including half-hour DST transitions. Migration 50 backfills disabled empty
schedules and adds an activity-request admission timestamp; other role rows and thermostat definitions are preserved.

A current-minute occurrence is durably consumed before invoking the existing activity service. The selected
configuration revision, original activation identity and scheduler lifetime fence admission. A stop, disable,
space deletion, concurrent manual request or expiry before admission causes refusal. Once an activity is admitted,
its existing original-operation completion and per-domain rules still apply. Space deletion/type changes remove
owned schedules in the existing lifecycle transaction.

Manual selection **or clearing** lasts until the next future trigger. A late tick cannot overwrite a manual request
admitted at/after the nominal trigger. A disabled/unavailable mode or an in-progress activity consumes the occurrence
without retry. There is no physical action backlog. Startup advances the persisted UTC watermark and marks an
unfinished claim interrupted. It evaluates the current plan for display but does not replay missed changes.
Backward clock movement withholds new automatic admission until the watermark is reached again.

Panel space pages show the current planned mode, next local date/time/timezone and manual indication. They offer no
schedule editing. Disconnect, unknown state, a stopped scheduler or clock uncertainty does not present cached values
as current. HTTP refetch follows `SpacesModule.ActivitySchedule.Changed`, activity-state changes, reconnect and a
minute refresh while a page owns a session; page disposal stops its polling. Planned mode and last admission status
are not proof of device convergence. Thermostat manual hold, explicit OFF, temporary overrides and protective guards
retain their existing precedence. Occupancy, sunrise/sunset, holidays and calendar integration remain separate.
