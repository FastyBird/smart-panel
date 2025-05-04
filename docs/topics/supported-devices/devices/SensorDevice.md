# Sensor Device

**Device Category**: `sensor`

The **Sensor** device represents a versatile monitoring unit capable of tracking various environmental
and safety parameters.

---

## Required Channels {id="required-channels"}

These channels are mandatory for the functionality of the sensor device:

| **Channel**          | **Description**                                                                | **Multiple** | **Details**                                |
|----------------------|--------------------------------------------------------------------------------|--------------|--------------------------------------------|
| `device_information` | Provides metadata about the device, such as manufacturer, model, and firmware. | No           | [See details](DeviceInformationChannel.md) |

---

## Optional Channels {id="optional-channels"}

These channels are optional and provide additional features:

| **Channel**                  | **Description**                                               | **Multiple** | **Details**                                       |
|------------------------------|---------------------------------------------------------------|--------------|---------------------------------------------------|
| `air_particulate`            | Monitors air quality by tracking particulate matter levels.   | No           | [See details](AirParticulateChannel.md)           |
| `battery`                    | Monitors the battery level and status of the sensor.          | No           | [See details](BatteryChannel.md)                  |
| `carbon_dioxide`             | Tracks carbon dioxide levels in the environment.              | No           | [See details](CarbonDioxideChannel.md)            |
| `carbon_monoxide`            | Tracks carbon monoxide levels in the environment.             | No           | [See details](CarbonMonoxideChannel.md)           |
| `contact`                    | Detects the state of physical contact (e.g., open or closed). | No           | [See details](ContactChannel.md)                  |
| `humidity`                   | Monitors the ambient humidity level.                          | No           | [See details](HumidityChannel.md)                 |
| `illuminance`                | Measures the intensity of light in the environment.           | No           | [See details](IlluminanceChannel.md)              |
| `leak`                       | Detects the presence of water or other liquid leaks.          | No           | [See details](LeakChannel.md)                     |
| `motion`                     | Detects motion within the sensor's range.                     | No           | [See details](MotionChannel.md)                   |
| `nitrogen_dioxide`           | Tracks levels of nitrogen dioxide in the air.                 | No           | [See details](NitrogenDioxideChannel.md)          |
| `occupancy`                  | Detects whether a space is occupied.                          | No           | [See details](OccupancyChannel.md)                |
| `ozone`                      | Monitors ozone levels in the environment.                     | No           | [See details](OzoneChannel.md)                    |
| `pressure`                   | Tracks air or fluid pressure.                                 | No           | [See details](PressureChannel.md)                 |
| `smoke`                      | Detects the presence of smoke in the environment.             | No           | [See details](SmokeChannel.md)                    |
| `sulphur_dioxide`            | Tracks levels of sulphur dioxide in the air.                  | No           | [See details](SulphurDioxideChannel.md)           |
| `temperature`                | Monitors the current ambient temperature.                     | No           | [See details](TemperatureChannel.md)              |
| `volatile_prganic_compounds` | Tracks the presence of volatile organic compounds in the air. | No           | [See details](VolatileOrganicCompoundsChannel.md) |

---

### Use Case Scenarios {id="use-case-scenarios"}

1. **Environmental Monitoring**:
    - Use channels like `temperature`, `humidity`, and `airParticulate` to monitor environmental conditions.

2. **Safety Applications**:
    - Track smoke, carbon monoxide, and carbon dioxide levels using their respective channels.
    - Detect leaks with the `leak` channel for enhanced safety.

3. **Occupancy and Motion Detection**:
    - Utilize the `motion` and `occupancy` channels for presence detection in smart environments.

4. **Energy Efficiency**:
    - Monitor the battery status of wireless sensors using the `battery` channel.

5. **Advanced Monitoring**:
    - Track less common parameters like `nitrogenDioxide`, `ozone`, and `volatileOrganicCompounds` for specialized use cases.

---

## Developer Notes {id="developer-notes"}

1. **Channel Implementation**:
    - Include the `device_information` channel for proper device identification.
    - Optional channels should be added based on the sensor's capabilities and intended use case.

2. **Integration**:
    - Ensure the mapping of sensor channels to their respective functionalities.
    - Use optional channels like `smoke`, `motion`, or `leak` for specific applications.

3. **Extensibility**:
    - The wide range of optional channels allows this device type to cover diverse use cases, from environmental monitoring to safety applications.
