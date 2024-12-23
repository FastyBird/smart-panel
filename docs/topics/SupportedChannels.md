# Supported Channels

This document provides an overview of all channel types supported by the system. Each channel type includes a brief description and links to detailed specifications.

---

## Overview

Channels define specific functionalities or data points for devices. Each channel is categorized based on its purpose, such as environmental monitoring, control, or media management. Channels are reusable across multiple device types, providing modularity and consistency.

---

## Channel List

### Environmental Monitoring Channels

- [Air Particulate](AirParticulateChannel.md)  
  Monitors particulate matter concentration (e.g., PM2.5 and PM10) for air quality insights.

- [Carbon Dioxide](CarbonDioxideChannel.md)  
  Tracks carbon dioxide levels for air quality monitoring.

- [Carbon Monoxide](CarbonMonoxideChannel.md)  
  Detects carbon monoxide for safety and air quality purposes.

- [Humidity](HumidityChannel.md)  
  Measures and monitors ambient humidity levels.

- [Illuminance](IlluminanceChannel.md)  
  Provides data about light intensity in a specific area.

- [Nitrogen Dioxide](NitrogenDioxideChannel.md)  
  Monitors nitrogen dioxide levels in the air.

- [Ozone](OzoneChannel.md)  
  Tracks ozone concentration for air quality monitoring.

- [Pressure](PressureChannel.md)  
  Measures atmospheric or liquid pressure.

- [Smoke](SmokeChannel.md)  
  Detects smoke levels for fire safety monitoring.

- [Sulphur Dioxide](SulphurDioxideChannel.md)  
  Tracks sulphur dioxide levels for air quality insights.

- [Temperature](TemperatureChannel.md)  
  Monitors ambient or targeted temperature values.

- [Volatile Organic Compounds](VolatileOrganicCompoundsChannel.md)  
  Tracks VOC levels for air quality monitoring.

---

### Security and Safety Channels

- [Alarm](AlarmChannel.md)  
  Represents an alarm or alert mechanism for safety or security purposes.

- [Contact](ContactChannel.md)  
  Detects open or closed states for doors, windows, or other objects.

- [Leak](LeakChannel.md)  
  Detects water or fluid leaks for safety monitoring.

- [Motion](MotionChannel.md)  
  Monitors motion detection for security or automation.

- [Occupancy](OccupancyChannel.md)  
  Detects presence or absence in a specific area.

---

### Control and Automation Channels

- [Cooler](CoolerChannel.md)  
  Manages cooling systems, such as air conditioners or refrigerators.

- [Fan](FanChannel.md)  
  Controls fan speed, direction, and operational status.

- [Heater](HeaterChannel.md)  
  Manages heating systems for climate control.

- [Light](LightChannel.md)  
  Controls brightness, color, and power state of lighting systems.

- [Lock](LockChannel.md)  
  Represents smart locks with locking and status monitoring capabilities.

- [Outlet](OutletChannel.md)  
  Monitors and controls power supply to connected devices.

- [Switcher](SwitcherChannel.md)  
  Generic on/off switch for controlling devices.

- [Valve](ValveChannel.md)  
  Manages flow control for water, gas, or other fluids.

- [Window Covering](WindowCoveringChannel.md)  
  Controls position and tilt of blinds, curtains, or shades.

---

### Media and Communication Channels

- [Camera](CameraChannel.md)  
  Provides video and image streams from surveillance or monitoring cameras.

- [Doorbell](DoorbellChannel.md)  
  Represents smart doorbell functionalities, including notifications and interactions.

- [Media Input](MediaInputChannel.md)  
  Manages input sources for media systems.

- [Media Playback](MediaPlaybackChannel.md)  
  Controls playback features for audio or video media.

- [Microphone](MicrophoneChannel.md)  
  Captures audio input for communication or monitoring.

- [Speaker](SpeakerChannel.md)  
  Provides audio output capabilities for media and alerts.

- [Television](TelevisionChannel.md)  
  Manages TV input, playback, and sound controls.

---

### Power and Energy Channels

- [Battery](BatteryChannel.md)  
  Tracks battery levels, status, and charging information.

- [Electrical Energy](ElectricalEnergyChannel.md)  
  Monitors total energy consumption over time.

- [Electrical Power](ElectricalPowerChannel.md)  
  Provides real-time power usage, voltage, and current information.

---

## Developer Notes

1. **Channel Specifications**: Each channel has a dedicated page detailing required and optional properties.
2. **Reusability**: Channels are designed to be reusable across multiple device types.
3. **Extensibility**: New channels can be added following the same structure for seamless integration.

---

## Adding New Channels

To add a new channel:
1. Define a unique category type.
2. Specify required and optional properties.
3. Ensure the documentation follows the standard Writerside format.

For guidelines, refer to the [ChannelIntegrationGuide.md](ChannelIntegrationGuide.md).