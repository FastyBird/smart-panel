# Supported Devices

This section provides an overview of the various device categories supported by our application, along with their
associated channels.

Each category have a required channels which have to be implemented and optional channels which could be implemented.

## Air Conditioner

**Device Category**: `air_conditioner`

Air conditioners provide cooling for indoor environments, often paired with additional features like heating or
dehumidification. This category supports devices that regulate temperature and airflow for comfort and efficiency.

### Required Channels {id="required-channels_air-conditioner"}

- **Cooler**: Controls cooling functionality. [See details](Cooler.md)
- **Temperature**: Monitors temperature within the space. [See details](Temperature.md)
- **Device Information**: Provides metadata about the device. [See details](DeviceInformation.md)

### Optional Channels {id="optional-channels_air-conditioner"}

- **Fan**: Controls fan speed or airflow direction. [See details](Fan.md)
- **Humidity**: Monitors humidity levels within the space. [See details](Humidity.md)
- **Leak**: Detects potential water leaks from the air conditioner. [See details](Leak.md)

## Doorbell

**Device Category**: `doorbell`

Doorbells provide a way to notify homeowners of visitors. Modern doorbells often include additional features such
as video monitoring, two-way audio communication, and integration with smart locks.

### Required Channels {id="required-channels_doorbell"}

- **Doorbell**: Manages the doorbell functionality, such as button presses. [See details](Doorbell.md)
- **Device Information**: Provides metadata about the device. [See details](DeviceInformation.md)

### Optional Channels {id="optional-channels_doorbell"}

- **Lock**: Adds the ability to control a door lock associated with the doorbell. [See details](Lock.md)
- **Microphone**: Enables two-way audio communication. [See details](Microphone.md)
- **Speaker**: Supports audio output for communication or alerts. [See details](Speaker.md)
- **Camera**: Enables video monitoring of the door area. [See details](Camera.md)

## Door Lock

**Device Category**: `door_lock`

Door locks provide security and access control for doors, enabling homeowners to lock and unlock doors remotely.

### Required Channels {id="required-channels_door-lock"}

- **Lock**: Provides the ability to control the lock state (locked/unlocked). [See details](Lock.md)
- **Device Information**: Provides metadata about the device. [See details](DeviceInformation.md)

### Optional Channels {id="optional-channels_door-lock"}

- **Contact**: Detects whether the door is open or closed. [See details](Contact.md)

## Fan

**Device Category**: `fan`

Fans provide air circulation and ventilation in indoor spaces. They can vary in functionality, offering features
like speed control, oscillation.

### Required Channels {id="required-channels_fan"}

- **Fan**: Controls the fan's power state, speed, and optional oscillation. [See details](Fan.md)
- **Device Information**: Provides metadata about the device. [See details](DeviceInformation.md)

### Optional Channels {id="optional-channels_fan"}

- **Electrical Energy**: Monitors energy consumption of the fan over time. [See details](ElectricalEnergy.md)
- **Electrical Power**: Provides real-time power usage of the fan. [See details](ElectricalPower.md)

## Heater

**Device Category**: `heater`

Heaters provide warmth for indoor spaces, often with features such as adjustable temperature, energy efficiency.

### Required Channels {id="required-channels_heater"}

- **Heater**: Controls the heating functionality, including power state and heating intensity. [See details](Heater.md)
- **Temperature**: Monitors the current temperature within the space. [See details](Temperature.md)
- **Device Information**: Provides metadata about the device. [See details](DeviceInformation.md)

### Optional Channels {id="optional-channels_heater"}

- **Humidity**: Monitors humidity levels within the space to ensure comfort and prevent dryness. [See details](Humidity.md)

## Lighting

**Device Category**: `lighting`

Lighting devices provide illumination for indoor and outdoor spaces. These devices may include features such as
adjustable brightness, color control, and energy efficiency.

### Required Channels {id="required-channels_lighting"}

- **Light**: Controls the lighting functionality, including brightness, color, and power state. [See details](Light.md)
- **Device Information**: Provides metadata about the device. [See details](DeviceInformation.md)

### Optional Channels {id="optional-channels_lighting"}

- **Electrical Energy**: Monitors energy consumption of the lighting device over time. [See details](ElectricalEnergy.md)
- **Electrical Power**: Provides real-time power usage of the lighting device. [See details](ElectricalPower.md)

## Outlet

**Device Category**: `outlet`

Smart outlets provide control over power delivery to connected devices, enabling features such as on/off switching,
energy monitoring. They are ideal for managing non-smart appliances and monitoring power usage.

### Required Channels {id="required-channels_outlet"}

- **Outlet**: Controls the outlet’s power state (on/off). [See details](Outlet.md)
- **Device Information**: Provides metadata about the device. [See details](DeviceInformation.md)

### Optional Channels {id="optional-channels_outlet"}

- **Electrical Energy**: Monitors energy consumption of connected devices over time. [See details](ElectricalEnergy.md)
- **Electrical Power**: Provides real-time power usage of connected devices. [See details](ElectricalPower.md)

## Switcher

**Device Category**: `switcher`

Switchers control the on/off state of connected devices or circuits. They provide a basic mechanism for integrating
non-smart devices into a smart home system.

### Required Channels {id="required-channels_switcher"}

- **Switcher**: Controls the switch state (on/off). [See details](Switcher.md)
- **Device Information**: Provides metadata about the device. [See details](DeviceInformation.md)

### Optional Channels {id="optional-channels_switcher"}

- **Electrical Energy**: Monitors energy consumption of connected devices over time. [See details](ElectricalEnergy.md)
- **Electrical Power**: Provides real-time power usage of connected devices. [See details](ElectricalPower.md)
