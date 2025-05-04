# Switcher Device

**Device Category**: `switcher`

The **Switcher** device represents a controllable outlet or switch that can toggle the power supply to connected devices and monitor energy usage. It supports multiple outlets for power control.

---

## Required Channels {id="required-channels"}

These channels are mandatory for the functionality of the switcher device:

| **Channel**          | **Description**                                                                | **Multiple** | **Details**                                |
|----------------------|--------------------------------------------------------------------------------|--------------|--------------------------------------------|
| `outlet`             | Controls the on/off state of the connected outlets or switches.                | Yes          | [See details](OutletChannel.md)            |
| `device_information` | Provides metadata about the device, such as manufacturer, model, and firmware. | No           | [See details](DeviceInformationChannel.md) |

---

## Optional Channels {id="optional-channels"}

These channels are optional and provide additional features:

| **Channel**         | **Description**                             | **Multiple** | **Details**                               |
|---------------------|---------------------------------------------|--------------|-------------------------------------------|
| `electrical_energy` | Tracks total energy consumption over time.  | No           | [See details](ElectricalEnergyChannel.md) |
| `electrical_power`  | Provides real-time power usage information. | No           | [See details](ElectricalPowerChannel.md)  |

---

### Use Case Scenarios {id="use-case-scenarios"}

1. **Power Control**:
   - Use the `outlet` channel to toggle the power supply on or off for connected devices.
   - For multi-outlet devices, control each outlet independently.

2. **Energy Monitoring**:
   - Track energy consumption with the `electrical_energy` channel for billing or usage optimization.
   - Monitor real-time power usage with the `electrical_power` channel to identify energy-hungry devices.

---

## Developer Notes {id="developer-notes"}

1. **Channel Implementation**:
   - The `device_information` channel is required for identifying the device and providing basic metadata.
   - Implement multiple `outlet` channels for devices with multiple controllable switches or sockets.

2. **Integration**:
   - Add the `electrical_energy` and `electrical_power` channels to enable energy monitoring features.

3. **Extensibility**:
   - This device can be further enhanced by adding custom features for specific hardware, like timers or schedules for each outlet.

4. **Handling Multiple Outlets**:
   - Ensure that each `outlet` channel is uniquely identified and managed within the device for seamless user control.
