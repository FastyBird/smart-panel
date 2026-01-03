import 'package:fastybird_smart_panel/modules/devices/models/properties/generic_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
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
import 'package:fastybird_smart_panel/modules/devices/views/properties/saturation.dart';
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

/// Registry of channel property model builders by type
Map<String, ChannelPropertyModel Function(Map<String, dynamic>)>
    channelPropertyModelMappers = {};

/// Register a channel property model mapper for a specific type
void registerChannelPropertyModelMapper(
  String type,
  ChannelPropertyModel Function(Map<String, dynamic>) mapper,
) {
  channelPropertyModelMappers[type] = mapper;
}

/// Build a channel property model from JSON data
/// Falls back to GenericChannelPropertyModel for unknown types
ChannelPropertyModel buildChannelPropertyModel(
    String type, Map<String, dynamic> data) {
  final builder = channelPropertyModelMappers[type];

  if (builder != null) {
    return builder(data);
  } else {
    // Unknown type, use generic model
    return GenericChannelPropertyModel.fromJson(data);
  }
}

/// Helper to create a property view with attributes from model
T _createPropertyView<T extends ChannelPropertyView>(
  ChannelPropertyModel model,
  T Function({
    required String id,
    required String type,
    required String channel,
    ChannelPropertyCategory category,
    String? name,
    List<Permission> permission,
    DataType dataType,
    String? unit,
    FormatType? format,
    InvalidValueType? invalid,
    double? step,
    ValueType? defaultValue,
    ValueType? value,
  }) constructor,
) {
  return constructor(
    id: model.id,
    type: model.type,
    channel: model.channel,
    category: model.category,
    name: model.name,
    permission: model.permission,
    dataType: model.dataType,
    unit: model.unit,
    format: model.format,
    invalid: model.invalid,
    step: model.step,
    defaultValue: model.defaultValue,
    value: model.value,
  );
}

/// Build a channel property view from a model
ChannelPropertyView buildChannelPropertyView(ChannelPropertyModel property) {
  switch (property.category) {
    case ChannelPropertyCategory.active:
      return _createPropertyView(property, ActiveChannelPropertyView.new);
    case ChannelPropertyCategory.angle:
      return _createPropertyView(property, AngleChannelPropertyView.new);
    case ChannelPropertyCategory.brightness:
      return _createPropertyView(property, BrightnessChannelPropertyView.new);
    case ChannelPropertyCategory.colorBlue:
      return _createPropertyView(property, ColorBlueChannelPropertyView.new);
    case ChannelPropertyCategory.colorGreen:
      return _createPropertyView(property, ColorGreenChannelPropertyView.new);
    case ChannelPropertyCategory.colorRed:
      return _createPropertyView(property, ColorRedChannelPropertyView.new);
    case ChannelPropertyCategory.colorTemperature:
      return _createPropertyView(
          property, ColorTemperatureChannelPropertyView.new);
    case ChannelPropertyCategory.colorWhite:
      return _createPropertyView(property, ColorWhiteChannelPropertyView.new);
    case ChannelPropertyCategory.connectionType:
      return _createPropertyView(
          property, ConnectionTypeChannelPropertyView.new);
    case ChannelPropertyCategory.consumption:
      return _createPropertyView(property, ConsumptionChannelPropertyView.new);
    case ChannelPropertyCategory.current:
      return _createPropertyView(property, CurrentChannelPropertyView.new);
    case ChannelPropertyCategory.density:
      return _createPropertyView(property, DensityChannelPropertyView.new);
    case ChannelPropertyCategory.detected:
      return _createPropertyView(property, DetectedChannelPropertyView.new);
    case ChannelPropertyCategory.direction:
      return _createPropertyView(property, DirectionChannelPropertyView.new);
    case ChannelPropertyCategory.distance:
      return _createPropertyView(property, DistanceChannelPropertyView.new);
    case ChannelPropertyCategory.duration:
      return _createPropertyView(property, DurationChannelPropertyView.new);
    case ChannelPropertyCategory.event:
      return _createPropertyView(property, EventChannelPropertyView.new);
    case ChannelPropertyCategory.fault:
      return _createPropertyView(property, FaultChannelPropertyView.new);
    case ChannelPropertyCategory.firmwareRevision:
      return _createPropertyView(
          property, FirmwareRevisionChannelPropertyView.new);
    case ChannelPropertyCategory.frequency:
      return _createPropertyView(property, FrequencyChannelPropertyView.new);
    case ChannelPropertyCategory.hardwareRevision:
      return _createPropertyView(
          property, HardwareRevisionChannelPropertyView.new);
    case ChannelPropertyCategory.hue:
      return _createPropertyView(property, HueChannelPropertyView.new);
    case ChannelPropertyCategory.humidity:
      return _createPropertyView(property, HumidityChannelPropertyView.new);
    case ChannelPropertyCategory.inUse:
      return _createPropertyView(property, InUseChannelPropertyView.new);
    case ChannelPropertyCategory.infrared:
      return _createPropertyView(property, InfraredChannelPropertyView.new);
    case ChannelPropertyCategory.inputSource:
      return _createPropertyView(property, InputSourceChannelPropertyView.new);
    case ChannelPropertyCategory.level:
      return _createPropertyView(property, LevelChannelPropertyView.new);
    case ChannelPropertyCategory.linkQuality:
      return _createPropertyView(property, LinkQualityChannelPropertyView.new);
    case ChannelPropertyCategory.locked:
      return _createPropertyView(property, LockedChannelPropertyView.new);
    case ChannelPropertyCategory.manufacturer:
      return _createPropertyView(property, ManufacturerChannelPropertyView.new);
    case ChannelPropertyCategory.measured:
      return _createPropertyView(property, MeasuredChannelPropertyView.new);
    case ChannelPropertyCategory.mode:
      return _createPropertyView(property, ModeChannelPropertyView.new);
    case ChannelPropertyCategory.model:
      return _createPropertyView(property, ModelChannelPropertyView.new);
    case ChannelPropertyCategory.obstruction:
      return _createPropertyView(property, ObstructionChannelPropertyView.new);
    case ChannelPropertyCategory.on:
      return _createPropertyView(property, OnChannelPropertyView.new);
    case ChannelPropertyCategory.overCurrent:
      return _createPropertyView(property, OverCurrentChannelPropertyView.new);
    case ChannelPropertyCategory.overPower:
      return _createPropertyView(property, OverPowerChannelPropertyView.new);
    case ChannelPropertyCategory.overVoltage:
      return _createPropertyView(property, OverVoltageChannelPropertyView.new);
    case ChannelPropertyCategory.pan:
      return _createPropertyView(property, PanChannelPropertyView.new);
    case ChannelPropertyCategory.peakLevel:
      return _createPropertyView(property, PeakLevelChannelPropertyView.new);
    case ChannelPropertyCategory.percentage:
      return _createPropertyView(property, PercentageChannelPropertyView.new);
    case ChannelPropertyCategory.position:
      return _createPropertyView(property, PositionChannelPropertyView.new);
    case ChannelPropertyCategory.power:
      return _createPropertyView(property, PowerChannelPropertyView.new);
    case ChannelPropertyCategory.rate:
      return _createPropertyView(property, RateChannelPropertyView.new);
    case ChannelPropertyCategory.remaining:
      return _createPropertyView(property, RemainingChannelPropertyView.new);
    case ChannelPropertyCategory.remoteKey:
      return _createPropertyView(property, RemoteKeyChannelPropertyView.new);
    case ChannelPropertyCategory.saturation:
      return _createPropertyView(property, SaturationChannelPropertyView.new);
    case ChannelPropertyCategory.serialNumber:
      return _createPropertyView(property, SerialNumberChannelPropertyView.new);
    case ChannelPropertyCategory.source:
      return _createPropertyView(property, SourceChannelPropertyView.new);
    case ChannelPropertyCategory.speed:
      return _createPropertyView(property, SpeedChannelPropertyView.new);
    case ChannelPropertyCategory.status:
      return _createPropertyView(property, StatusChannelPropertyView.new);
    case ChannelPropertyCategory.swing:
      return _createPropertyView(property, SwingChannelPropertyView.new);
    case ChannelPropertyCategory.tampered:
      return _createPropertyView(property, TamperedChannelPropertyView.new);
    case ChannelPropertyCategory.temperature:
      return _createPropertyView(property, TemperatureChannelPropertyView.new);
    case ChannelPropertyCategory.tilt:
      return _createPropertyView(property, TiltChannelPropertyView.new);
    case ChannelPropertyCategory.track:
      return _createPropertyView(property, TrackChannelPropertyView.new);
    case ChannelPropertyCategory.type:
      return _createPropertyView(property, TypeChannelPropertyView.new);
    case ChannelPropertyCategory.units:
      return _createPropertyView(property, UnitsChannelPropertyView.new);
    case ChannelPropertyCategory.voltage:
      return _createPropertyView(property, VoltageChannelPropertyView.new);
    case ChannelPropertyCategory.volume:
      return _createPropertyView(property, VolumeChannelPropertyView.new);
    case ChannelPropertyCategory.zoom:
      return _createPropertyView(property, ZoomChannelPropertyView.new);
    default:
      return _createPropertyView(property, GenericChannelPropertyView.new);
  }
}

Map<ChannelPropertyCategory, IconData Function()> channelPropertyIconMappers = {
  ChannelPropertyCategory.generic: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.active: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.angle: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.brightness: () => MdiIcons.weatherSunny,
  ChannelPropertyCategory.colorBlue: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.colorGreen: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.colorRed: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.colorTemperature: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.colorWhite: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.command: () => MdiIcons.send,
  ChannelPropertyCategory.connectionType: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.consumption: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.current: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.density: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.detected: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.direction: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.distance: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.duration: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.event: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.fault: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.firmwareRevision: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.frequency: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.hardwareRevision: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.hue: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.humidity: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.inUse: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.infrared: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.inputSource: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.level: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.linkQuality: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.locked: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.manufacturer: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.measured: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.model: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.mode: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.obstruction: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.on: () => MdiIcons.power,
  ChannelPropertyCategory.overCurrent: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.overVoltage: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.overPower: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.pan: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.peakLevel: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.percentage: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.position: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.power: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.rate: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.remaining: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.remoteKey: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.saturation: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.serialNumber: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.source: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.speed: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.status: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.swing: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.tampered: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.temperature: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.tilt: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.track: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.type: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.units: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.voltage: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.volume: () => MdiIcons.databaseCog,
  ChannelPropertyCategory.zoom: () => MdiIcons.databaseCog,
};

IconData buildChannelPropertyIcon(ChannelPropertyCategory category) {
  final builder = channelPropertyIconMappers[category];

  if (builder != null) {
    return builder();
  } else {
    return MdiIcons.databaseCog;
  }
}
