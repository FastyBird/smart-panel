# Virtual devices in Apple Home

Select compatible virtual devices in the HomeKit bridge mapping wizard. They keep their Smart Panel identities, configuration and history. HomeKit commands use the same backend command services as other clients.

| Virtual mode             | Standard HomeKit presentation                                                                                       | Limits                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Sensor aggregate         | TemperatureSensor, HumiditySensor, LightSensor or CarbonDioxideSensor for the matching aggregate                    | Current quorum, source freshness and producer quality govern availability.                                                                   |
| Numeric sensor transform | TemperatureSensor, HumiditySensor or LightSensor when the output uses the corresponding supported quantity and unit | Custom analog values, volts, resistance, pressure and arbitrary numeric quantities have no generic numeric HomeKit service here.             |
| Light actuator group     | Lightbulb with common ON, brightness, color temperature, hue and saturation controls when present                   | RGB-only controls have no mapping. ON means any member is on. Brightness may be a representative average. HomeKit has no mixed-members enum. |
| Climate controller       | Thermostat with requested target mode/setpoints and confirmed current heating/cooling activity                      | Protective floor readings and detailed inhibit/fault reasons remain available in Smart Panel.                                                |

Binary contact, motion and occupancy aggregates use their corresponding standard sensor services. The existing sensor mapper also supports physical leak and smoke properties.

Switch and outlet actuator groups expose ON through the existing services. Outlet IN_USE is readable only when the managed group supplies current in-use evidence; an absent or unknown IN_USE is not inferred from ON. Ordinary legacy outlets retain their existing fallback.

Fan groups expose Fanv2 Active from ON. Mixed fan/sensor devices retain their existing sensor services and channel subtypes when rebuilt. RotationSpeed requires the native unsigned integer percentage contract with an explicit bounded range inside 0–100; the native range and step grid are retained. Discrete low/high/turbo/auto speeds have no guessed percentage mapping. Boolean swing maps to SwingMode. RotationDirection requires exactly the canonical clockwise/counter_clockwise enum; TargetFanState requires exactly auto/manual, without extra specialty modes. CurrentFanState is not inferred from a command acknowledgement or ON. Fanv2 has no StatusFault characteristic: individual unknown readings fail with a communication error. Optional-control metadata changes are checked synchronously for reads and writes; unsupported contracts fail immediately and are withdrawn by the next rebuild. A changed supported speed range/grid also waits for its replacement characteristic before accepting commands.

Covering groups retain the existing WindowCovering service and channel UUID subtype. Managed canonical position enums map to 0/25/50/75/100, while canonical opening/closing map to moving states and opened/closed/stopped map to STOPPED. Unknown enum members, numeric strings, disagreement and expired evidence fail; they cannot become a fabricated stopped state. Numeric positions retain finite/range validation. Legacy physical covering conversion remains unchanged.

CO₂ channels expose standard CarbonDioxideLevel from CONCENTRATION (0–100000 ppm), optional CarbonDioxidePeakLevel from a real PEAK_LEVEL field, and CarbonDioxideDetected only from a real boolean DETECTED field. HAP requires the detection characteristic even on a concentration-only service; without that field it is explicitly unavailable from initialization and on every GET. No normal detection value or threshold is invented. Concentration and peak require the canonical FLOAT/ppm metadata contract; mismatches are omitted, and metadata drift fails existing reads before a rebuild withdraws the old binding. Concentration remains readable independently. StatusFault accounts for each bound component, so a successful concentration read cannot clear a missing/invalid detection or peak fault.

Unsupported specialty controls and dew-point quantities have no generic HAP service. Arbitrary numeric converter outputs do not become compatible with those services.

## Readings and faults

Unavailable derived readings report a HAP communication failure (“No Response” when Apple Home reads them). A restart, missing producer, expired source evidence, graph/configuration invalidation or invalid derived value cannot restore a historical value as a current measurement. GET checks current producer authority even before a notification arrives. Reading a value does not refresh its age or evaluate a controller.

A valid degraded measurement remains readable. Sensor services that support the standard StatusFault characteristic also report degraded or unavailable quality and clear the fault when valid evidence recovers. How Apple Home displays an optional fault depends on the client. Thermostat and Lightbulb services do not advertise StatusFault in this integration; an unknown individual reading fails its own GET.

Managed numeric readings must fit the mapped HAP characteristic’s finite range. For example, CurrentTemperature supports negative Celsius, with the installed HAP implementation’s range of −270 to 100 °C. Values outside a supported range fail the read instead of being clamped to a boundary or replaced with 0, 20 or 25 °C. Existing physical-device fallback behavior is unchanged.

For a group, a known mixed ON state and valid representative brightness remain readable. A genuinely unknown color component reports a communication failure instead of zero/default color. A group SET succeeds only when every targeted member is confirmed. Partial or failed member outcomes return a HAP failure; successful member feedback remains authoritative. The backend retains detailed member outcomes. Materialized group properties remain read-only; composite command capability authorizes the backend command path without changing their permissions.

## Requested and actual thermostat state

TargetHeatingCoolingState expresses the user’s requested mode. CurrentHeatingCoolingState expresses confirmed branch feedback. A requested OFF with still-active heating during an unconfirmed release remains HEAT. Unknown feedback produces a communication failure; it does not prove heating, cooling or OFF.

Floor protection, physical window contacts, automatic window pauses, output claims and opposed-output exclusion remain backend controller responsibilities. A paused controller with confirmed inactive output shows current OFF while retaining its requested target mode. Standard thermostat characteristics cannot explain every floor/window inhibit, pending release, readiness or protective diagnostic. Use the Smart Panel thermostat detail for those diagnostics. A HomeKit request never bypasses backend validation or safety admission.

## Lifecycle and names

Offline devices fail reads and writes with a communication failure. Returning online refreshes current values. Deleted devices and devices whose changed structure is no longer supported are removed from the bridge mapping. Structure changes rebuild accessories with the same device-derived UUID. HomeKit keeps its own accessory names after pairing; rename accessories in Apple Home when needed.

## Verification boundary

Automated acceptance uses real HAP objects, production producer registries and aggregate/converter runtimes, core composite commands, SQLite metadata/history boundaries and controlled software providers. It does not advertise a bridge or command physical hardware. Passing those checks does not establish Apple Home pairing behavior, installed sensor calibration, actuator isolation, floor protection qualification or live heating/cooling commissioning. Those remain separate installation checks.

## Extension acceptance status (issue #1461)

The CO₂/fan/covering and legacy-profile slice is partial delivery of [#1461](https://github.com/FastyBird/smart-panel/issues/1461). Its software tests exercise real HAP characteristics through the mapper registry, current producer leases/events and command dispatcher; SQLite composite command tests cover switch/outlet/fan confirmation, partial/rejected outcomes and acceptance without reported optimism. They also cover initial unavailable detection, finite CO₂ bounds, independent component faults, exact expiry without a timer tick, cold-process persisted last-good rejection, recovery, enum conversion, mixed/unknown fields and accessory replacement fencing. Existing thermostat requested-versus-actual tests remain the compatibility baseline.

This slice does not qualify the staged Home Assistant/Zigbee2MQTT production takeovers, complete #1456/#1457, or satisfy native/composed thermostat acceptance. Those remain open for later composition with the separately developed climate work. No bridge is published and no pairing, mDNS advertisement or hardware command is part of these tests. Physical HomeKit acceptance follows publication of the alpha artifact.
