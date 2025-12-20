import 'package:fastybird_smart_panel/modules/devices/models/properties/home_assistant_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/shelly_ng_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/shelly_v1_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/third_party_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/wled_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/ui.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/angle.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_blue.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_green.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_red.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_white.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/connection_type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/consumption.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/current.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/density.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/direction.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/distance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/duration.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/event.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/firmware_revision.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/frequency.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/generic.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/hardware_revision.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/hue.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/in_use.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/infrared.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/input_source.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/link_quality.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/measured.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/model.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/obstruction.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/over_current.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/over_power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/over_voltage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/pan.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/peak_level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/percentage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/position.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/power.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/rate.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/remaining.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/remote_key.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/serial_number.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/source.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/speed.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/swing.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tilt.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/track.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/units.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/voltage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/volume.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/zoom.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

Map<String, ChannelPropertyModel Function(Map<String, dynamic>)>
    deviceModelMappers = {
  DeviceType.devicesThirdParty.value: (data) {
    return ThirdPartyChannelPropertyModel.fromJson(data);
  },
  DeviceType.devicesHomeAssistant.value: (data) {
    return HomeAssistantChannelPropertyModel.fromJson(data);
  },
  DeviceType.devicesShellyNg.value: (data) {
    return ShellyNgChannelPropertyModel.fromJson(data);
  },
  DeviceType.devicesShellyV1.value: (data) {
    return ShellyV1ChannelPropertyModel.fromJson(data);
  },
  DeviceType.devicesWled.value: (data) {
    return WledChannelPropertyModel.fromJson(data);
  },
};

ChannelPropertyModel buildChannelPropertyModel(
    String type, Map<String, dynamic> data) {
  final builder = deviceModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Channel property model can not be created. Unsupported device type: $type',
    );
  }
}

Map<ChannelPropertyCategory, ChannelPropertyView Function(ChannelPropertyModel)>
    channelPropertyViewsMappers = {
  ChannelPropertyCategory.generic: (ChannelPropertyModel channelPropertyModel) {
    return GenericChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.active: (ChannelPropertyModel channelPropertyModel) {
    return ActiveChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.angle: (ChannelPropertyModel channelPropertyModel) {
    return AngleChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.brightness:
      (ChannelPropertyModel channelPropertyModel) {
    return BrightnessChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.colorBlue:
      (ChannelPropertyModel channelPropertyModel) {
    return ColorBlueChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.colorGreen:
      (ChannelPropertyModel channelPropertyModel) {
    return ColorGreenChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.colorRed:
      (ChannelPropertyModel channelPropertyModel) {
    return ColorRedChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.colorTemperature:
      (ChannelPropertyModel channelPropertyModel) {
    return ColorTemperatureChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.colorWhite:
      (ChannelPropertyModel channelPropertyModel) {
    return ColorWhiteChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.connectionType:
      (ChannelPropertyModel channelPropertyModel) {
    return ConnectionTypeChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.consumption:
      (ChannelPropertyModel channelPropertyModel) {
    return ConsumptionChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.current: (ChannelPropertyModel channelPropertyModel) {
    return CurrentChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.density: (ChannelPropertyModel channelPropertyModel) {
    return DensityChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.detected:
      (ChannelPropertyModel channelPropertyModel) {
    return DetectedChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.direction:
      (ChannelPropertyModel channelPropertyModel) {
    return DirectionChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.distance:
      (ChannelPropertyModel channelPropertyModel) {
    return DistanceChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.duration:
      (ChannelPropertyModel channelPropertyModel) {
    return DurationChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.event: (ChannelPropertyModel channelPropertyModel) {
    return EventChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.fault: (ChannelPropertyModel channelPropertyModel) {
    return FaultChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.firmwareRevision:
      (ChannelPropertyModel channelPropertyModel) {
    return FirmwareRevisionChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.frequency:
      (ChannelPropertyModel channelPropertyModel) {
    return FrequencyChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.hardwareRevision:
      (ChannelPropertyModel channelPropertyModel) {
    return HardwareRevisionChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.hue: (ChannelPropertyModel channelPropertyModel) {
    return HueChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.humidity:
      (ChannelPropertyModel channelPropertyModel) {
    return HumidityChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.inUse: (ChannelPropertyModel channelPropertyModel) {
    return InUseChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.infrared:
      (ChannelPropertyModel channelPropertyModel) {
    return InfraredChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.inputSource:
      (ChannelPropertyModel channelPropertyModel) {
    return InputSourceChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.level: (ChannelPropertyModel channelPropertyModel) {
    return LevelChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.linkQuality:
      (ChannelPropertyModel channelPropertyModel) {
    return LinkQualityChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.locked: (ChannelPropertyModel channelPropertyModel) {
    return LockedChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.manufacturer:
      (ChannelPropertyModel channelPropertyModel) {
    return ManufacturerChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.measured:
      (ChannelPropertyModel channelPropertyModel) {
    return MeasuredChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.model: (ChannelPropertyModel channelPropertyModel) {
    return ModelChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.mode: (ChannelPropertyModel channelPropertyModel) {
    return ModeChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.obstruction:
      (ChannelPropertyModel channelPropertyModel) {
    return ObstructionChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.on: (ChannelPropertyModel channelPropertyModel) {
    return OnChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.overCurrent:
      (ChannelPropertyModel channelPropertyModel) {
    return OverCurrentChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.overVoltage:
      (ChannelPropertyModel channelPropertyModel) {
    return OverVoltageChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.overPower:
      (ChannelPropertyModel channelPropertyModel) {
    return OverPowerChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.pan: (ChannelPropertyModel channelPropertyModel) {
    return PanChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.peakLevel:
      (ChannelPropertyModel channelPropertyModel) {
    return PeakLevelChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.percentage:
      (ChannelPropertyModel channelPropertyModel) {
    return PercentageChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.position:
      (ChannelPropertyModel channelPropertyModel) {
    return PositionChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.power: (ChannelPropertyModel channelPropertyModel) {
    return PowerChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.rate: (ChannelPropertyModel channelPropertyModel) {
    return RateChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.remaining:
      (ChannelPropertyModel channelPropertyModel) {
    return RemainingChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.remoteKey:
      (ChannelPropertyModel channelPropertyModel) {
    return RemoteKeyChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.saturation:
      (ChannelPropertyModel channelPropertyModel) {
    return StatusChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.serialNumber:
      (ChannelPropertyModel channelPropertyModel) {
    return SerialNumberChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.source: (ChannelPropertyModel channelPropertyModel) {
    return SourceChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.speed: (ChannelPropertyModel channelPropertyModel) {
    return SpeedChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.status: (ChannelPropertyModel channelPropertyModel) {
    return StatusChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.swing: (ChannelPropertyModel channelPropertyModel) {
    return SwingChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.tampered:
      (ChannelPropertyModel channelPropertyModel) {
    return TamperedChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.temperature:
      (ChannelPropertyModel channelPropertyModel) {
    return TemperatureChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.tilt: (ChannelPropertyModel channelPropertyModel) {
    return TiltChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.track: (ChannelPropertyModel channelPropertyModel) {
    return TrackChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.type: (ChannelPropertyModel channelPropertyModel) {
    return TypeChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.units: (ChannelPropertyModel channelPropertyModel) {
    return UnitsChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.voltage: (ChannelPropertyModel channelPropertyModel) {
    return VoltageChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.volume: (ChannelPropertyModel channelPropertyModel) {
    return VolumeChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
  ChannelPropertyCategory.zoom: (ChannelPropertyModel channelPropertyModel) {
    return ZoomChannelPropertyView(
      channelPropertyModel: channelPropertyModel,
    );
  },
};

ChannelPropertyView buildChannelPropertyView(
  ChannelPropertyModel property,
) {
  final builder = channelPropertyViewsMappers[property.category];

  if (builder != null) {
    return builder(property);
  } else {
    throw ArgumentError(
      'Channel property view can not be created. Unsupported channel property category: ${property.category.value}',
    );
  }
}

Map<ChannelPropertyCategory, IconData Function()> channelPropertyIconMappers = {
  ChannelPropertyCategory.generic: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.active: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.angle: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.brightness: () {
    return MdiIcons.weatherSunny;
  },
  ChannelPropertyCategory.colorBlue: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.colorGreen: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.colorRed: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.colorTemperature: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.colorWhite: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.connectionType: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.consumption: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.current: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.density: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.detected: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.direction: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.distance: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.duration: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.event: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.fault: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.firmwareRevision: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.frequency: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.hardwareRevision: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.hue: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.humidity: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.inUse: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.infrared: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.inputSource: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.level: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.linkQuality: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.locked: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.manufacturer: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.measured: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.model: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.mode: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.obstruction: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.on: () {
    return MdiIcons.power;
  },
  ChannelPropertyCategory.overCurrent: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.overVoltage: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.overPower: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.pan: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.peakLevel: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.percentage: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.position: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.power: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.rate: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.remaining: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.remoteKey: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.saturation: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.serialNumber: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.source: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.speed: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.status: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.swing: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.tampered: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.temperature: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.tilt: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.track: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.type: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.units: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.voltage: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.volume: () {
    return MdiIcons.databaseCog;
  },
  ChannelPropertyCategory.zoom: () {
    return MdiIcons.databaseCog;
  },
};

IconData buildChannelPropertyIcon(ChannelPropertyCategory category) {
  final builder = channelPropertyIconMappers[category];

  if (builder != null) {
    return builder();
  } else {
    throw Exception(
      'Channel property icon can not be created. Unsupported channel property category: ${category.value}',
    );
  }
}
