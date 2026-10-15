# Virtual devices in Apple Home

Select compatible virtual devices in the HomeKit bridge mapping wizard. They keep their Smart Panel identities, configuration and history. HomeKit commands use the same backend command services as other clients.

| Virtual mode             | Standard HomeKit presentation                                                                                       | Limits                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Sensor aggregate         | TemperatureSensor for a temperature aggregate                                                                       | Current quorum, source freshness and producer quality govern availability.                                                                   |
| Numeric sensor transform | TemperatureSensor, HumiditySensor or LightSensor when the output uses the corresponding supported quantity and unit | Custom analog values, volts, resistance, pressure and arbitrary numeric quantities have no generic numeric HomeKit service here.             |
| Light actuator group     | Lightbulb with common ON, brightness, color temperature, hue and saturation controls when present                   | RGB-only controls have no mapping. ON means any member is on. Brightness may be a representative average. HomeKit has no mixed-members enum. |
| Climate controller       | Thermostat with requested target mode/setpoints and confirmed current heating/cooling activity                      | Protective floor readings and detailed inhibit/fault reasons remain available in Smart Panel.                                                |

The existing sensor mapper also supports motion, contact, occupancy, leak and smoke properties. This does not make arbitrary numeric converter outputs compatible with those services.

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
