# Space activity modes

The home-control plugin provides Work, Relax, Sleep, Entertainment and Away for rooms and zones.
These modes are independent of last-interaction tracking and media activities. Climate and security are
disabled in authored defaults. No startup action, custom mode authoring, scheduler, presence trigger or
virtual thermostat adapter is included. The Admin and Panel interfaces use the same saved configuration and persisted selection contract.

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
absolute setpoint and delta are mutually exclusive. Target-specific preset existence, ranges and deadband cannot
be validated without the future trusted adapter: preview/activation explicitly report unsupported meanwhile.
Configuration persistence does not claim target availability or send climate commands.

`SpaceClimateAutomationPort` only prepares an internal trusted activation contract. There is no whole virtual-device
plugin import or registered adapter. Future integration must implement owner/baseline compare-and-swap inside graph
and controller fences, reject foreign/legacy-unowned baselines, withdraw only a matching baseline on an unmapped
selection and retain source watermarks/tombstones so delayed Work cannot resurrect after Relax. A public owner token
or the existing broad baseline-clear operation cannot satisfy that contract. VD1458 remains open.

Enabled security reports unsupported because current security services expose status/acknowledgement, not arm/disarm.

## Admin configuration

The space detail Domains tab includes Activity modes for all five built-ins, including disabled modes.
Open Edit to enable or disable a mode, change its display order, and configure each domain. Lower display-order
numbers appear first; each mode is saved independently, so changing several orders is not an atomic reorder.
Reset to defaults is an explicit revision-checked write. Climate defaults remain disabled and unset. Enabling climate
requires an explicit Comfort/Eco/Away preset or a heat/cool temperature target or delta; Work never chooses a preset
implicitly. Climate and security settings can be saved but their unsupported actuation remains visible.

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
presence, custom activity authoring, the VD1458 climate bridge, security actuation and hardware qualification remain
separate work. Independent review, composed CI and alpha acceptance remain pending.
