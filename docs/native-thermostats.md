# Native Home Assistant and Zigbee2MQTT thermostats

A virtual thermostat can delegate regulation to one adopted physical climate unit. In the virtual thermostat
wizard, select **Native HA / Zigbee thermostat**, name the controller and select an eligible unit. Creating the
controller reserves its Smart Panel mode/setpoint controls and creates ordinary virtual properties with their own
identity and history. Creation sends no command to the physical unit and does not invent an initial requested mode.

Native delegation and guarded relay branches are mutually exclusive. The physical thermostat regulates temperature.
This strategy does not implement external ambient substitution, floor or condensation protection, parallel outputs,
or opposed-output protection. Those features retain their separately qualified guarded-branch contracts.

## Supported protocol shapes

Home Assistant units require exactly one registry-backed climate entity on the adopted device, explicit temperature
units, finite bounds and a positive step. When a stable HA climate state omits `temperature_unit`, the adapter reads
the same connection's explicit `get_config.unit_system.temperature`; missing or unsupported units are refused.
Core configuration changes revoke old captures. Native control also requires accepted state, entity-registry and core-configuration event subscriptions. A rejected subscription leaves native control unavailable while ordinary HA integration can remain connected. Celsius and Fahrenheit are converted at the boundary; the virtual API uses
Celsius. Explicit `heat` and `cool` require single-target support. Virtual `auto` means the provider's advertised
`heat_cool` range capability with both ordered targets; Home Assistant's separate `auto` program is not substituted.
Mode plus targets use one `climate.set_temperature` call with `hvac_mode`; mode-only uses `climate.set_hvac_mode`.
These are service acceptance outcomes, not an assertion of physical atomicity or output completion. See the
[HA climate action](https://www.home-assistant.io/actions/climate.set_temperature/) and
[climate entity contract](https://contributors.home-assistant.io/core/entities/climate/).

The initial Zigbee2MQTT profile requires one unambiguous climate expose on the default endpoint, model/vendor
metadata, writable mode and setpoint exposes with explicit Celsius bounds/step. The canonical IEEE address and
exact model/firmware/exposes participate in binding validation. Supported requests change one mode or one setpoint.
Compound, `auto` and `heat_cool` requests are refused before publication. Several JSON fields or an exposed enum do
not establish atomic execution. This is capability-qualified support, not a promise for every model or firmware.
See [Zigbee2MQTT exposes](https://www.zigbee2mqtt.io/guide/usage/exposes.html).

## Requests, observations and external changes

The Admin editor shows requested values separately from observed temperature, mode and activity. It also shows each
operation as accepted/unconfirmed, refused or unknown. A service response, MQTT publication or later matching value
does not prove that the virtual request caused physical activity. Activity is taken only from explicit qualified
provider feedback; requested heat never fabricates an observed heating state.

Each explicit request has a UUID and configuration revision. The requested patch and pending ledger entry commit
before transport. Reusing the same UUID does not resend it. Newer requests and binding/lifecycle changes revoke
older dispatch windows; an old completion can update only its own journal. A lost HTTP response requires an
authoritative refresh before another request. Automatic background work never replays the last request to fight
upstream drift. HA automations, local controls and other external writers remain outside Smart Panel's reservation.

HA discovery snapshots are capability metadata, not new measurement evidence. Observations require current raw
events and preserve measurement age. Zigbee observations require qualified live raw packets whose receipt and measurement both postdate binding; retained,
cached, duplicate, offline and stale packets cannot supply current activity. Restart retains interrupted work as
uncertain, reacquires observations and sends no automatic replay.

Capability changes with the same unit and branch topology can be explicitly revalidated. This updates the existing
mode choices and target ranges/steps together, preserving property identity and history. Moved or replaced local
controls are refused. Physical remapping and changed branch topology require a new controller. Explicit release validates its revision before withdrawing request authority. Requests still waiting for admission
wait for that decision; a stale release leaves them unaffected. An admitted release relinquishes the Smart Panel
reservation after joining its issued work; it sends no OFF command and makes no statement about the physical unit's current regulation.
Deletion retains the binding and request ledger so it cannot silently free an unresolved reservation. Changing an
upstream identity or moving existing command aliases does not free their reservation; the original binding must be
explicitly released first.

## Software evidence and installed equipment

The provider protocol fixtures exercise the production HA service transport and Zigbee command publisher, including
exact payloads, refusals, uncertainty, connection/capability changes and observation age. SQLite lifecycle and HTTP
authoring fixtures cover durable requests, exclusive ownership, original completion, restart and ordinary virtual
creation. Admin fixtures cover explicit commands and stale response fencing. Their results are recorded with the
delivery PR; source presence alone is not a passing qualification.

No equipment commands, deployment or commissioning are performed by these fixtures. Published-alpha, model/firmware
equipment tests and final composed/HomeKit acceptance remain with #1462/#1463 and their parent tasks.
