#!/usr/bin/env python3
"""
Validate that channel/device view implementations match the spec.

This script reads the spec JSON files and checks that:
- Properties marked as `required: true` use `.first` (non-nullable)
- Properties marked as `required: false` use `.firstOrNull` (nullable)
"""

import json
import os
import re
import sys
from pathlib import Path

# Find project root
script_dir = Path(__file__).parent.absolute()
project_root = script_dir.parent.parent.parent

SPEC_DIR = project_root / 'spec' / 'devices'
CHANNEL_VIEWS_DIR = project_root / 'apps' / 'panel' / 'lib' / 'modules' / 'devices' / 'views' / 'channels'
DEVICE_VIEWS_DIR = project_root / 'apps' / 'panel' / 'lib' / 'modules' / 'devices' / 'views' / 'devices'

# Property category to expected Dart class name
PROPERTY_CLASS_MAP = {
    'active': 'ActiveChannelPropertyView',
    'angle': 'AngleChannelPropertyView',
    'aqi': 'AqiChannelPropertyView',
    'brightness': 'BrightnessChannelPropertyView',
    'change_needed': 'ChangeNeededChannelPropertyView',
    'child_lock': 'ChildLockChannelPropertyView',
    'color_blue': 'ColorBlueChannelPropertyView',
    'color_green': 'ColorGreenChannelPropertyView',
    'color_red': 'ColorRedChannelPropertyView',
    'color_temperature': 'ColorTemperatureChannelPropertyView',
    'color_white': 'ColorWhiteChannelPropertyView',
    'command': 'CommandChannelPropertyView',
    'connection_type': 'ConnectionTypeChannelPropertyView',
    'consumption': 'ConsumptionChannelPropertyView',
    'current': 'CurrentChannelPropertyView',
    'defrost_active': 'DefrostActiveChannelPropertyView',
    'density': 'DensityChannelPropertyView',
    'detected': 'DetectedChannelPropertyView',
    'direction': 'DirectionChannelPropertyView',
    'distance': 'DistanceChannelPropertyView',
    'duration': 'DurationChannelPropertyView',
    'event': 'EventChannelPropertyView',
    'fault': 'FaultChannelPropertyView',
    'firmware_revision': 'FirmwareRevisionChannelPropertyView',
    'frequency': 'FrequencyChannelPropertyView',
    'hardware_revision': 'HardwareRevisionChannelPropertyView',
    'hue': 'HueChannelPropertyView',
    'humidity': 'HumidityChannelPropertyView',
    'in_use': 'InUseChannelPropertyView',
    'infrared': 'InfraredChannelPropertyView',
    'input_source': 'InputSourceChannelPropertyView',
    'level': 'LevelChannelPropertyView',
    'life_remaining': 'LifeRemainingChannelPropertyView',
    'link_quality': 'LinkQualityChannelPropertyView',
    'locked': 'LockedChannelPropertyView',
    'manufacturer': 'ManufacturerChannelPropertyView',
    'measured': 'MeasuredChannelPropertyView',
    'mist_level': 'MistLevelChannelPropertyView',
    'mode': 'ModeChannelPropertyView',
    'model': 'ModelChannelPropertyView',
    'natural_breeze': 'NaturalBreezeChannelPropertyView',
    'obstruction': 'ObstructionChannelPropertyView',
    'on': 'OnChannelPropertyView',
    'over_current': 'OverCurrentChannelPropertyView',
    'over_power': 'OverPowerChannelPropertyView',
    'over_voltage': 'OverVoltageChannelPropertyView',
    'pan': 'PanChannelPropertyView',
    'peak_level': 'PeakLevelChannelPropertyView',
    'percentage': 'PercentageChannelPropertyView',
    'position': 'PositionChannelPropertyView',
    'power': 'PowerChannelPropertyView',
    'rate': 'RateChannelPropertyView',
    'remaining': 'RemainingChannelPropertyView',
    'remote_key': 'RemoteKeyChannelPropertyView',
    'reset': 'ResetChannelPropertyView',
    'saturation': 'SaturationChannelPropertyView',
    'serial_number': 'SerialNumberChannelPropertyView',
    'siren': 'SirenChannelPropertyView',
    'source': 'SourceChannelPropertyView',
    'speed': 'SpeedChannelPropertyView',
    'state': 'StateChannelPropertyView',
    'status': 'StatusChannelPropertyView',
    'swing': 'SwingChannelPropertyView',
    'tampered': 'TamperedChannelPropertyView',
    'temperature': 'TemperatureChannelPropertyView',
    'tilt': 'TiltChannelPropertyView',
    'timer': 'TimerChannelPropertyView',
    'track': 'TrackChannelPropertyView',
    'triggered': 'TriggeredChannelPropertyView',
    'type': 'TypeChannelPropertyView',
    'units': 'UnitsChannelPropertyView',
    'voltage': 'VoltageChannelPropertyView',
    'volume': 'VolumeChannelPropertyView',
    'warm_mist': 'WarmMistChannelPropertyView',
    'water_tank_empty': 'WaterTankEmptyChannelPropertyView',
    'water_tank_full': 'WaterTankFullChannelPropertyView',
    'water_tank_level': 'WaterTankLevelChannelPropertyView',
    'zoom': 'ZoomChannelPropertyView',
}

# Channel category to expected Dart class name
CHANNEL_CLASS_MAP = {
    'air_particulate': 'AirParticulateChannelView',
    'air_quality': 'AirQualityChannelView',
    'alarm': 'AlarmChannelView',
    'battery': 'BatteryChannelView',
    'camera': 'CameraChannelView',
    'carbon_dioxide': 'CarbonDioxideChannelView',
    'carbon_monoxide': 'CarbonMonoxideChannelView',
    'contact': 'ContactChannelView',
    'cooler': 'CoolerChannelView',
    'dehumidifier': 'DehumidifierChannelView',
    'device_information': 'DeviceInformationChannelView',
    'door': 'DoorChannelView',
    'doorbell': 'DoorbellChannelView',
    'electrical_energy': 'ElectricalEnergyChannelView',
    'electrical_power': 'ElectricalPowerChannelView',
    'fan': 'FanChannelView',
    'filter': 'FilterChannelView',
    'flow': 'FlowChannelView',
    'gas': 'GasChannelView',
    'heater': 'HeaterChannelView',
    'humidity': 'HumidityChannelView',
    'humidifier': 'HumidifierChannelView',
    'illuminance': 'IlluminanceChannelView',
    'leak': 'LeakChannelView',
    'light': 'LightChannelView',
    'lock': 'LockChannelView',
    'media_input': 'MediaInputChannelView',
    'media_playback': 'MediaPlaybackChannelView',
    'microphone': 'MicrophoneChannelView',
    'motion': 'MotionChannelView',
    'nitrogen_dioxide': 'NitrogenDioxideChannelView',
    'occupancy': 'OccupancyChannelView',
    'outlet': 'OutletChannelView',
    'ozone': 'OzoneChannelView',
    'pressure': 'PressureChannelView',
    'robot_vacuum': 'RobotVacuumChannelView',
    'smoke': 'SmokeChannelView',
    'speaker': 'SpeakerChannelView',
    'sulphur_dioxide': 'SulphurDioxideChannelView',
    'switcher': 'SwitcherChannelView',
    'television': 'TelevisionChannelView',
    'temperature': 'TemperatureChannelView',
    'thermostat': 'ThermostatChannelView',
    'valve': 'ValveChannelView',
    'volatile_organic_compounds': 'VolatileOrganicCompoundsChannelView',
    'window_covering': 'WindowCoveringChannelView',
}


def parse_property_accessors(content: str) -> dict[str, bool]:
    """
    Parse a Dart file and extract property accessor definitions.
    Returns a map of property class name to whether it's nullable (uses firstOrNull).
    """
    accessors = {}

    # Pattern to match property accessors
    pattern = re.compile(
        r'(\w+ChannelPropertyView)\??\s+get\s+\w+\s*=>\s*properties\.whereType<(\w+ChannelPropertyView)>\(\)\.(first(?:OrNull)?)',
        re.MULTILINE
    )

    for match in pattern.finditer(content):
        class_name = match.group(2)
        accessor = match.group(3)
        is_nullable = accessor == 'firstOrNull'
        accessors[class_name] = is_nullable

    return accessors


def parse_channel_accessors(content: str) -> dict[str, bool]:
    """
    Parse a device view file and extract channel accessor definitions.
    Returns a map of channel class name to whether it's nullable (uses firstOrNull).
    """
    accessors = {}

    # Pattern to match channel accessors
    pattern = re.compile(
        r'(\w+ChannelView)\??\s+get\s+\w+\s*=>\s*channels\.whereType<(\w+ChannelView)>\(\)\.(first(?:OrNull)?)',
        re.MULTILINE
    )

    for match in pattern.finditer(content):
        class_name = match.group(2)
        accessor = match.group(3)
        is_nullable = accessor == 'firstOrNull'
        accessors[class_name] = is_nullable

    return accessors


def validate_channel_views():
    """Validate channel view property optionality against spec."""
    print("=" * 60)
    print("Validating Channel Views")
    print("=" * 60)

    # Load channels spec
    with open(SPEC_DIR / 'channels.json', 'r') as f:
        channels_spec = json.load(f)

    mismatches = []
    skipped = []
    checked = 0

    for channel_cat, channel_spec in channels_spec.items():
        if channel_cat == 'generic':
            continue

        # Check if view file exists
        view_file = CHANNEL_VIEWS_DIR / f'{channel_cat}.dart'
        if not view_file.exists():
            skipped.append(channel_cat)
            continue

        # Parse the view file
        content = view_file.read_text()
        accessors = parse_property_accessors(content)

        # Check each property
        properties = channel_spec.get('properties', {})
        for prop_cat, prop_spec in properties.items():
            is_required = prop_spec.get('required', False)
            expected_class = PROPERTY_CLASS_MAP.get(prop_cat)

            if not expected_class:
                continue

            if expected_class not in accessors:
                # Property not defined directly in view
                continue

            checked += 1
            is_nullable_in_view = accessors[expected_class]

            if is_required and is_nullable_in_view:
                mismatches.append(
                    f"  {channel_cat}.{prop_cat}: spec=required, view uses .firstOrNull (should use .first)"
                )
            elif not is_required and not is_nullable_in_view:
                mismatches.append(
                    f"  {channel_cat}.{prop_cat}: spec=optional, view uses .first (should use .firstOrNull)"
                )

    if skipped:
        print(f"\nSkipped channels (no view file): {', '.join(skipped)}")

    print(f"\nChecked {checked} property accessors")

    if mismatches:
        print(f"\n{len(mismatches)} MISMATCHES FOUND:")
        for m in mismatches:
            print(m)
        return False
    else:
        print("\nAll channel view properties match spec!")
        return True


def validate_device_views():
    """Validate device view channel optionality against spec."""
    print("\n" + "=" * 60)
    print("Validating Device Views")
    print("=" * 60)

    # Load devices spec
    with open(SPEC_DIR / 'devices.json', 'r') as f:
        devices_spec = json.load(f)

    mismatches = []
    skipped = []
    checked = 0

    for device_cat, device_spec in devices_spec.items():
        if device_cat == 'generic':
            continue

        # Check if view file exists
        view_file = DEVICE_VIEWS_DIR / f'{device_cat}.dart'
        if not view_file.exists():
            skipped.append(device_cat)
            continue

        # Parse the view file
        content = view_file.read_text()
        accessors = parse_channel_accessors(content)

        # Check each channel
        channels = device_spec.get('channels', {})
        for ch_cat, ch_spec in channels.items():
            is_required = ch_spec.get('required', False)
            expected_class = CHANNEL_CLASS_MAP.get(ch_cat)

            if not expected_class:
                continue

            if expected_class not in accessors:
                # Channel not defined directly in view
                continue

            checked += 1
            is_nullable_in_view = accessors[expected_class]

            if is_required and is_nullable_in_view:
                mismatches.append(
                    f"  {device_cat}.{ch_cat}: spec=required, view uses .firstOrNull (should use .first)"
                )
            elif not is_required and not is_nullable_in_view:
                mismatches.append(
                    f"  {device_cat}.{ch_cat}: spec=optional, view uses .first (should use .firstOrNull)"
                )

    if skipped:
        print(f"\nSkipped devices (no view file): {', '.join(skipped)}")

    print(f"\nChecked {checked} channel accessors")

    if mismatches:
        print(f"\n{len(mismatches)} MISMATCHES FOUND:")
        for m in mismatches:
            print(m)
        return False
    else:
        print("\nAll device view channels match spec!")
        return True


def main():
    print("Spec Validation Script")
    print(f"Project root: {project_root}")
    print()

    channel_ok = validate_channel_views()
    device_ok = validate_device_views()

    print("\n" + "=" * 60)
    if channel_ok and device_ok:
        print("SUCCESS: All views match the spec!")
        return 0
    else:
        print("FAILED: Some views do not match the spec")
        return 1


if __name__ == '__main__':
    sys.exit(main())
