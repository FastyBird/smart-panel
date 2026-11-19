# Admin device setup and detail extensions

> Visual layout, components and styling follow [`admin-ui-design-spec.md`](admin-ui-design-spec.md) (for example
> `state-view` replaces `EmptyState`, and wizards use the template 9 widths). This document covers registration and
> behaviour.

Device plugins share an entry page for choosing what to add, followed by a common guided setup shell. The Devices list also retains **Manual configuration** for the existing raw forms. Cameras are outside this change.

## Guided setup

Register `components.deviceWizard` on a devices-scoped plugin element. A definition supplies either a flow component or a list of variants. The entry page selects the plugin or a directly exposed variant before mounting its flow inside `DeviceWizardShell`. Choosing a plugin or setup method is not a numbered step; the flow starts at its own first step.

```typescript
components: {
	deviceWizard: {
		component: defineAsyncComponent(() => import('./components/device-setup.vue')),
	},
},
```

The optional `deviceWizard.selection` metadata controls the entry page, independently of device capabilities. Omit it or use `kind: 'integration'` for a normal integration card. It can provide a translated `label`, short translated `description`, `icon` and display `order`; the plugin's name and description are defaults. Use `kind: 'section'` with `section: { label, description }` to contribute a plugin-owned section. Its variants become individual cards on the entry page, each opening the corresponding flow directly. A section with a single component contributes one card. Virtual Devices uses this contract; the core never tests for a virtual plugin identifier. Future special-purpose plugins can declare another section in the same way.

```typescript
selection: {
	kind: 'section',
	section: {
		label: 'examplePlugin.wizard.selection.heading',
		description: 'examplePlugin.wizard.selection.description',
	},
},
```

The entry page uses Element Plus cards and the existing page header with search. Search matches translated card labels, descriptions and the owning plugin/section, ignoring case and accents. Empty search results use `EmptyState`. Only enabled, devices-scoped wizard definitions appear. Manual configuration remains a separate link. A regular integration with multiple methods has its own unnumbered method chooser; Back from a directly exposed section variant returns to the main entry page.

For multiple setup methods, register `variants` instead of `component`. Each variant has a stable `id`, translated `label` and `description`, an `icon`, a `component`, and optional `props`. Virtual device kinds use this contract; a future integration can use it for local and cloud setup. Only register methods the backend actually supports.

The route is `/devices/wizard/:type?variant=<id>`; `/devices/wizard` opens plugin selection. A single variant is selected automatically. Disabled plugins cannot mount a flow, including through a direct link. The old Virtual, Modbus and Simulator setup URLs redirect to this common route.

A flow renders plugin content and registers its reactive steps with the shared shell. Use the common `DeviceWizardSteps` component for linear flows. It accepts the active step, translated step labels, validation, an optional asynchronous `beforeNext`, and final action descriptors. The plugin's form is its default slot. The shell owns the page layout, step indicator, action buttons, serialization of clicks and navigation guards. Actions appear in one persistent footer outside the scrolling step content. Cancel stays on the left; Back, plugin actions and Next/Create stay on the right and wrap on narrow screens. The page header contains the title and the step indicator remains above the content. Returning `false` from `beforeNext` or rejecting it leaves the current step and data intact; the plugin presents the validation problem beside its fields.

Every Next action validates the current step before advancing. Keep Next available for incomplete or invalid form values, so clicking it can explain what needs correction. Reserve `canAdvance`/disabled states for unavailable resources, loading or an operation already in progress. `useWizardValidation` owns attempted-step feedback; bind `validation.error(field)` to `ElFormItem.error`, and use `useWizardFieldError` inside nested step components. Validate each field on its own step, including numeric domains and conditional controls. Cross-field selection problems belong beside the affected group. The shared `beforeNext` hook may then await a backend configuration review before entering the final summary.

Final confirmation submits the reviewed draft once. Preserve the summary and entered values while the request runs, including after failure. Do not automatically replace it with a fresh preview, reload candidates or copy a create response into the draft. Show a save error beside the affected field, in the review check row or as a flash message. Explicit Back/Refresh can start another review; terminal success or a completed batch result is displayed only after all associated operations finish. Runtime sample freshness and offline status do not invalidate a structurally valid device configuration. Authentication rejection is handled by the shared session middleware: a token rejected by the auth guard is refreshed even when its local expiry has not elapsed, concurrent requests share refresh, and the original request body is replayed at most once. Requests and pending token/profile responses are fenced to one uninterrupted login; logout or a replacement login prevents old requests or responses from adopting the new session. Unrecoverable sessions raise one global sign-in notification. Group catalog and authoring operations leave HTTP 401 feedback to that handler rather than presenting raw token errors as configuration validation.

For discovery, the existing `IDeviceWizardAdapter` remains the integration logic behind the common discovery flow. Discovery session replacement, selected rows, pairing cleanup, partial results and adding another batch retain their existing semantics. Confirmation keeps its reviewed inventory after a failed adoption and builds retries from that same snapshot. User edits mark the flow dirty until completion or an explicit reset. While adoption runs it freezes inventory and entered values; manual discovery fields declare whether they are required and report missing values inline. Plugins register that flow through the same `deviceWizard` definition, passing `adapterFactory` in `props`.

`useDeviceWizardData(key, initial)` keeps a reactive draft in the current wrapper session, so replacing individual step components does not lose their shared data. Switching plugin or variant creates a new wrapper session after the leave guard permits it. `useDeviceWizardComplete()` marks a confirmed create as complete before opening its detail; a producer can still be clearing its pending state at this point. Do not mark a failed or uncertain write complete.

Capabilities describe discovery, batch setup and manual setup. `manual: true` explicitly permits the generic raw form for a wizard-backed element without a custom add form, as used by Simulator. A wizard-only element such as Modbus is excluded from the raw picker.

Flow components must not introduce independent headers, step bars or navigation buttons. Editors reused outside guided setup may render their inline editing actions when stepping is disabled.

### Measurement review

Measurement wizards validate configuration before advancing from Processing to Review. Failed checks stay beside the settings in Processing; the final page shows an already reviewed configuration, an Element Plus result summary and an input table. Unit and processing controls explain their effect with inline help and informational alerts.

Configuration validity is independent of runtime sample quality. Offline sources, expired samples and an unavailable calculation do not block saving a valid configuration. The reviewed calculation is a fixed snapshot with its evaluation time; source reports and sample expiry do not replace it or trigger new checks on Create. A configuration edit clears the review. Creating sends the reviewed configuration directly, keeping the page stable until navigation. The backend still validates source contracts and graph revisions atomically; save failures appear as an error alert in the calculation preview. Existing measurement editors retain their explicit preview/save workflow.

Numeric conversion groups input/output ranges and operator parameters into responsive columns. Thermistor operators require a temperature output and an eligible raw-voltage source, including identified Shelly voltmeters; Celsius sources are already converted. `DeviceWizardReviewChecks` shows field-specific problems in Processing; the final review displays settings in their own cards without a duplicate checks table. An invalid numeric configuration or explicitly entered test value must be corrected before proceeding. Inline editors retain the check table alongside their result.

Empty lists and selectors use the common `EmptyState` (`ElResult` and `IconWithChild`), matching data tables. Do not use `ElEmpty`. A failed review is not an empty list: keep the configuration and validation results visible.

## Device detail tabs

Register `components.deviceDetailTabs` on the device element. Each tab has a stable `id`, translated `label`, `icon`, a Vue `component`, and an optional `visible(device)` predicate. The host passes `device` to the component and supplies the tab layout and scroll container.

Plugin tabs are namespaced as `plugin:<id>` in the `tab` query parameter. The shared overview remains the default, and an unknown or unavailable tab falls back to it. Plugin content mounts only while its tab is selected, including for an existing device whose integration has been disabled, so its configuration and diagnostics remain accessible. Components must dispose polling, subscriptions and pending reads when unmounted.

The previous `deviceDetailSection`, `deviceWizardAdapter` registration property and `routes.wizard` launcher contract have been removed. External admin extensions must migrate to `deviceDetailTabs` and `deviceWizard`; there are no separate setup launchers. The discovery adapter itself is still supported as integration logic.

## Category sections

A module can show content on the device detail page for every device of given categories, whatever the device's plugin. Register an element with `modules: [DEVICES_MODULE_NAME]` and `components.deviceCategorySection = { id, categories, component, order? }` on the module (not a plugin). The host reads them through `useDeviceCategorySections(device)` and renders the matching sections sorted by `order`, inside the Overview tab above the channel list, passing `device`. Sections render cards only: no page chrome and no save footer. The Cameras module uses this slot to show the live player and stream profiles on every `camera` and `doorbell` device.

## Space modes

The home-control space detail keeps domains, devices, scenes and displays, and adds a separate **Modes** tab. Domains define the device roles available in the space. Modes define coordinated changes; schedules and presence rules determine when to activate them.

Mode rows show human-readable summaries of their saved actions. The editor offers leaving a domain unchanged or configuring its action. Thermostat preset definitions remain on the thermostat; a space mode references a preset or an explicit numeric temperature action.

Schedules and presence settings open from compact cards. Their saved configuration is shared between the card and its modal editor, avoiding a second configuration store or duplicate reads. Closing an editor waits for an in-flight save and asks before discarding a draft. Closing after discard destroys the editor; route navigation uses the same guards. Unsupported space types do not expose mode controls.


Virtual creation flows share `VirtualWizardLayout`, `VirtualWizardSummary` and `VirtualWizardReviewSection`. The form occupies the main column and the device summary occupies a separate right column; container queries stack them when the available content width is narrow. Review sections expose an Edit action to the corresponding step through a standard small Element Plus button in each card header. These actions are disabled during creation, and edits still pass through the existing step validation before returning to Review. Inline device editors keep their existing layout. Review uses the same introductory header spacing for every kind, followed by 16px between cards. The basic configuration card is always named **Details**, independently of the first step label; other cards keep content-specific names such as Sources, Processing, Members or Controls. Creation forms are not mounted in Review, so empty form elements cannot add an extra gap before the first card.

Aggregate and numeric conversion creation use a searchable source picker. Selected readings remain separate from available readings; sources in the chosen room are suggested first, followed by sources from any selected contextual zone and then other sources. Each candidate appears in one group, with room membership taking precedence over zone membership; empty groups disappear. The same grouping helper is used by projection, dew-point, group and thermostat source selectors without changing their eligibility checks. Search matches device, channel/property and room names without case or accent sensitivity. Offline devices remain selectable and retained missing bindings stay visible for removal.

The measurement sidebar debounces backend calculation requests while sources or processing settings change. `evaluateDraft` only reads the draft result: it does not change review state, graph revisions, errors or saving authorization. Cancellation and a generation fence discard superseded replies. The previous calculation remains visible with refresh feedback until its replacement arrives. Entering Review still uses the primary validated preview; background work stops in Review and while saving. Review shows that frozen snapshot, including its source states, until the user explicitly chooses Recalculate or edits a section.


Introductory virtual-device forms share a 600px maximum field width, top-aligned bold labels, optional placement labels and inline help. Room and zone hints describe source suggestions, not restrictions. Measurement catalogue loading covers the whole wizard content, including the summary; the shell header and footer remain outside the overlay. Background calculation refreshes keep their smaller status feedback and do not block the form.


The shared summary column is 400px wide at desktop content widths and stacks below the form on narrower screens. Available sources are grouped in Element Plus cards with compact headers and a single search field. Measurement ages use localized compact units; missing, invalid, future or epoch-zero measurement timestamps display a dash. Zigbee2MQTT deliberately uses epoch zero for some cached evidence with unknown source time; this presentation does not infer connection state from that timestamp. Offline or unknown-time readings are not presented as current values. Calculation refresh feedback uses the Recalculate button spinner, without inserting status text or duplicating the selected-source list in the summary.


Aggregate and numeric-conversion review sources reuse `VirtualWizardSourcePicker` in read-only mode: the same source, room, value, age and state columns, without selection or removal controls. Weighted aggregates also show the configured relative weight. Source metadata and evaluator evidence are captured when the primary preview succeeds and remain fixed until an explicit recalculation or configuration edit. The calculation sidebar has no duplicate settings or input table; save errors remain visible as a dedicated alert.


Dew-point authoring follows the same measurement wizard UI: one source picker for both required roles (air temperature in Celsius and relative humidity in percent), grouped by room/zones. Adding another source of the same role replaces that role only. Full-content catalogue loading, readable age/timestamp-skew help, an isolated debounced backend preview and a read-only source review use the common virtual components. Background evaluation never updates save approval or graph revisions. The review snapshot and its source table remain fixed during saving; explicit Recalculate can renew approval after a failed create. Dew point uses the versioned Magnus formula to report the condensation temperature and does not itself control heating or cooling.


Numeric creation mounts its source picker only while the Sources step is active. Output and Processing must not pre-render the complete source list. Empty source bindings do not subscribe to the entire reactive property store, and creation does not watch the revision of a nonexistent output. Candidate and row-label joins use one ID index per collection rather than repeated scans or repeated `Object.values` calls for every source. Keep these constraints when extending the form: real installations can have thousands of properties and hundreds of eligible numeric inputs.


Source selection must keep rendering cost bounded as installations grow. Each placement group shows
20 available readings per page; search covers the full catalogue, and selecting, filtering or switching
pages must preserve existing bindings. Only selected rows need a one-second age update. The available
catalogue must not be rebuilt on the age clock, and localized age formatters are reused with a bounded
cache for the active locale. Wizard entry owns its catalogue fetch; the parent device list defers its
fetch and validation until the user returns to that list.


When Shelly addon telemetry exposes both a display-only `temperature:100` reading and a fingerprinted
`probe-temperature:temperature:100:<fingerprint>` reading, the add-source list prefers the latter only
when the same device/component/property/unit has exactly one canonical representation in the offered
catalogue. This is a presentation preference, independent of online state; it does not remap existing
bindings or promote cached measurements into qualified live evidence. Full metadata remains available
for existing bindings and their review.


Wizard forms use Element Plus's standard required asterisk through `ElFormItem.required` (or form rules),
including conditional requirements. Optional fields have no asterisk or `(optional)` label suffix.
Shared device name, category, room and zone labels, placeholders, hints and required messages come
from `devicesModule.fields.devices`, as in the regular device forms. Wizard-specific help explains
source suggestions and calculations; it does not redefine common device fields. Validation errors
appear beside their inputs when the user tries Next, and remain reactive while correcting values.

The source picker distinguishes a last known value from proof of a fresh sample. A finite numeric
or boolean value from an online source remains visible when its sample time is null, invalid or
the epoch sentinel used by cached Zigbee2MQTT state. Last report then says Unknown and the value
explains its cached status in a tooltip. Offline cached readings remain unavailable in the picker.
This presentation does not change source qualification or renew sample age for calculation previews
or producer runtime.

Request failures use flash notifications (`useVirtualWizardError`) rather than error alerts inside
the wizard. Field validation stays beside its input; mapping constraints also report a notification
when the user tries Next. Background preview retries do not generate notifications automatically;
failed explicit recalculation does. Informational hints and reading quality remain in the content.
Removal of unsaved sources, channels, members, calibration points and settings uses the shared
`VirtualWizardRemoveButton`: small, plain warning button with the trash icon and a translated
accessible label and tooltip, matching the device list.

Numeric Processing keeps local validation at the form fields. It does not rebuild a separate table of
validation errors while the user types. Only the active wizard form section is mounted. Background
conversion evaluation is batched after rendering and waits 700 ms after the last edit; it never disables
the form. Mandatory server preparation on Next shows progress on that action and prevents duplicate
submissions. Input/output range failures of a hypothetical sample remain calculation warnings, not
configuration failures, and do not prevent Review or creation of an otherwise validated policy. Invalid
policies, malformed numeric fields and unsupported calculation failures still block completion.


### Actuator group authoring

Actuator groups use three steps: Details, Members and controls, and Review. Details shares the
placement fields and compact form width with other virtual devices. Fields are ordered Name,
Group of, Room and Zones; the name is entered manually. Members and Review use the full content width. The member matrix fixes
the name column on the left and Remove on the right; capability columns scroll horizontally. Its
last row chooses the optional controls exposed by the group, while required controls stay checked.
RGB and hue/saturation controls are selected as complete tuples.

`VirtualWizardAddSources` is the common available-source list for measurement and group creation:
search, room/zone/other cards and 20 candidates per group per page. Group candidates show compatibility
and the controls lost by adding them. Individual row capabilities come from a baseline catalog request
with no selected channels. Each subsequent catalog response evaluates the intersection of a candidate
and the currently selected channels; it must not be used as the candidate's individual capability list.
Eligibility and compatible units/ranges remain server decisions. Do not send the current optional
control selection to the creation candidate query: a compatible dimmer can join an RGB group and
remove unsupported colors, rather than being rejected for lacking those optional controls.
Instead, send `excluded_capabilities` so the server checks each candidate's prospective common
controls minus exclusions, retaining required controls and checking quarantine only for that contract.
The full common control list is still returned for display. Explicit `capabilities` remain mandatory
requirements for callers that prohibit narrowing, including existing repair flows.

The catalog reloads on profile, member, property-contract or control-exclusion changes, not on live
readings. Changing exclusions requires one compatibility request. Superseded requests are aborted,
reads time out, and disposal cancels pending work.
A single primary draft preview approves Members and controls before Review. Review snapshots member
labels and the server's chosen control contracts, uses small bordered descriptions, and keeps the
approved graph revision stable through a failed create. Editing a section requests a new approval;
background metadata changes do not silently replace the reviewed group.


### Projection authoring

Projection uses three steps: Device, Mapping and Review. Device combines a manually entered name,
category cards and the common room/zone fields. Common categories appear first; expanding the grid
keeps every other supported category available. Controller-only categories are omitted from Projection. Specialized virtual devices, such as
thermostats, use their own variants on the entry page. The sidebar describes required and optional channels from the same generated
specification helper used by Mapping.

Mapping has a channel navigator and a property table for the active channel. Required channels are
present from the start; optional channels are added explicitly and survive back navigation even
before they have mappings. Adding an optional channel requires its own mandatory properties and
at least one mapped source. Removing it clears its selections and supersedes pending verdicts.
The channel shortcut fills empty properties, preserves manual choices and rechecks retained sources.

Each property has one virtualized device/channel/property selector. Opening it loads server-approved
choices lazily in batches of at most 256; the cache depends on source contracts, not live values.
Room and zone grouping follows the shared placement preferences. Existing unavailable/refused sources
remain visible for correction. Selections and Next use the existing backend compatibility endpoint;
Next rechecks the full mapping and selects a channel with outstanding problems. Compatibility reads
time out, discard superseded replies and are cancelled when the component unmounts. Session failures
remain global authentication feedback and never count as successful compatibility checks.

Review shows Details and a single Mapping card, grouped by channel with resolved device/channel/
property names and a summary of the number of channels, properties and source devices. Edit returns
to the relevant step. The existing create payload, source-hiding option, zone assignment and stable
submission guard remain owned by the review component.


Projection selector options contain only stable labels and values, including a unique value for each
placement group. Full device objects must never enter Select V2 options: its deep watcher would
subscribe to live status updates. `useProjectionSourceMetadata` detaches the eligible device, channel
and property metadata from telemetry. Value/status-only record replacements preserve catalogue and
option identities; contract changes invalidate them. Catalogue versions are computed lazily so a bulk
fetch cannot force a full scan per committed property. Live values render in a small per-source child
component, and the mapping table keeps the same row array when only selection/checking state changes.

Source choice verification first excludes obvious type/permission mismatches, then asks the server
in batches of 32. Approved choices appear after each batch while further loading is indicated in the
selector footer. Closing the selector cancels the active read; reopening resumes from already checked
source IDs. Both approved and refused results are cached for the current metadata version. A batch
timeout reports a failure and never turns unchecked sources into compatible choices.

## Relay thermostat authoring

Relay thermostat creation uses Details, Sensors, Relays, Configuration and Review. Details contains
only the name and placement. The shared aggregate-style source picker offers readable Celsius
temperature properties and physical boolean CONTACT/DETECTED properties. Temperature rows choose
ambient or floor; contact rows have a fixed role. Each role can be assigned once, and swapping
temperature roles preserves the limits of each physical binding. Materialized aggregates are offered
only as ambient sources. Placement groups, search, offline selection and missing-binding removal use
the same components as other virtual devices.

The relay step uses that same list and table with a heating/cooling role per selected output. It
retains the existing supported relay contract, unique bindings and eight-member limit. Returning to
selection and removing a branch clears its obsolete setpoint and unsupported requested mode.
Configuration owns setpoints, sample ages, contact boolean mappings, delays, leases and protective
settings; it renders only the selected comfort branches. Creation never edits bindings or roles in
that step. Each step validates its own inputs, with the existing backend contract/ownership preview
running only after Configuration. The frozen Review and final create request preserve the existing
sample qualification and hardware guards. Existing thermostat configuration/repair remains available
through the inline editor.

In creation, selecting a floor sensor automatically enables floor protection (editable starting
values: 28 °C maximum and 1 °C recovery hysteresis). Removing it removes the new floor policy and
obsolete new local guards. Local relay protection can only use a selected floor sensor also offered
by the backend's qualified same-device contract; a unique compatible choice is bound automatically.
Parallel heating still requires qualified local protection for every output. Installed/retained
protections are never detached automatically. The display-only member floor override is kept in
existing configuration, not exposed in creation.

Active heating/cooling branches start at 21/25 °C. Source ages start at 300 seconds and relay leases
at 600 seconds. Enabling trend detection or cooling protection fills their editable numeric starting
values; stored configurations and subsequent user edits are preserved. Cooling protection still
requires dew-point and cooled-surface bindings plus a qualified protective relay profile. Configuring
those fields alone does not make an unqualified installation eligible for cooling.

Cooling protection inputs are selected in the shared Sensors table: dedicated virtual Dew point
outputs have a fixed role, and supported temperature probes can be assigned to Cooled surface.
Up to eight surface probes may be selected for different relay devices. These wizard selections
are not sent as thermostat control-source roles; each cooling member stores its selected dew-point
and surface dependencies. The member editor offers only selected inputs, filters surface probes
through the backend's same-device authoring context, and auto-binds unique compatible choices.
Missing selections route back to Sensors; an incompatible local probe remains a Configuration
field error. Review includes the cooling sources actually bound to members. Switching off a new
cooling protection clears its draft dependencies; installed protections retain their lifecycle rules.

The relay-backed thermostat's current guarded actuator contract is Shelly NG only, enforced by
both the backend's canonical actuator identity and the admin picker. Ambient/contact sources are
not restricted to that provider. This UI work does not broaden the actuator provider contract or
change runtime qualification/freshness requirements.
