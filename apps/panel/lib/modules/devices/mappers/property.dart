import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_permission_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/generic_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/album.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/artist.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/alarm_state.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/angle.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/aqi.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/change_needed.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/child_lock.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/command.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_blue.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_green.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_red.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/color_white.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/connection_type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/consumption.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/current.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/concentration.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/defrost_active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/direction.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/distance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/duration.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/event.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault_description.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/firmware_revision.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/frequency.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/generic.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/hardware_revision.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/hue.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/in_use.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/infrared.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/last_event.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/illuminance.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/life_remaining.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/link_quality.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/locked.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/manufacturer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mist_level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/model.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mute.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/natural_breeze.dart';
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
import 'package:fastybird_smart_panel/modules/devices/views/properties/pressure.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/rate.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/remaining.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/remote_key.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/reset.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/saturation.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/serial_number.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/siren.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/source.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/source_label.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/speed.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/state.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/swing.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tilt.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/timer.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/track.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/triggered.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/voltage.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/volume.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/warm_mist.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/water_tank_empty.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/water_tank_full.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/water_tank_level.dart';
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
    DevicesModulePropertyCategory category,
    String? name,
    List<DevicesModulePermissionType> permission,
    DevicesModuleDataType dataType,
    String? unit,
    FormatType? format,
    InvalidValueType? invalid,
    double? step,
    ValueType? defaultValue,
    PropertyValueState? valueState,
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
    valueState: model.valueState,
  );
}

/// Build a channel property view from a model
ChannelPropertyView buildChannelPropertyView(ChannelPropertyModel property) {
  switch (property.category) {
    case DevicesModulePropertyCategory.active:
      return _createPropertyView(property, ActiveChannelPropertyView.new);
    case DevicesModulePropertyCategory.alarmState:
      return _createPropertyView(property, AlarmStateChannelPropertyView.new);
    case DevicesModulePropertyCategory.album:
      return _createPropertyView(property, AlbumChannelPropertyView.new);
    case DevicesModulePropertyCategory.angle:
      return _createPropertyView(property, AngleChannelPropertyView.new);
    case DevicesModulePropertyCategory.aqi:
      return _createPropertyView(property, AqiChannelPropertyView.new);
    case DevicesModulePropertyCategory.artist:
      return _createPropertyView(property, ArtistChannelPropertyView.new);
    case DevicesModulePropertyCategory.brightness:
      return _createPropertyView(property, BrightnessChannelPropertyView.new);
    case DevicesModulePropertyCategory.changeNeeded:
      return _createPropertyView(property, ChangeNeededChannelPropertyView.new);
    case DevicesModulePropertyCategory.childLock:
      return _createPropertyView(property, ChildLockChannelPropertyView.new);
    case DevicesModulePropertyCategory.colorBlue:
      return _createPropertyView(property, ColorBlueChannelPropertyView.new);
    case DevicesModulePropertyCategory.colorGreen:
      return _createPropertyView(property, ColorGreenChannelPropertyView.new);
    case DevicesModulePropertyCategory.colorRed:
      return _createPropertyView(property, ColorRedChannelPropertyView.new);
    case DevicesModulePropertyCategory.colorTemperature:
      return _createPropertyView(
          property, ColorTemperatureChannelPropertyView.new);
    case DevicesModulePropertyCategory.colorWhite:
      return _createPropertyView(property, ColorWhiteChannelPropertyView.new);
    case DevicesModulePropertyCategory.command:
      return _createPropertyView(property, CommandChannelPropertyView.new);
    case DevicesModulePropertyCategory.connectionType:
      return _createPropertyView(
          property, ConnectionTypeChannelPropertyView.new);
    case DevicesModulePropertyCategory.consumption:
      return _createPropertyView(property, ConsumptionChannelPropertyView.new);
    case DevicesModulePropertyCategory.current:
      return _createPropertyView(property, CurrentChannelPropertyView.new);
    case DevicesModulePropertyCategory.concentration:
      return _createPropertyView(property, ConcentrationChannelPropertyView.new);
    case DevicesModulePropertyCategory.defrostActive:
      return _createPropertyView(property, DefrostActiveChannelPropertyView.new);
    case DevicesModulePropertyCategory.detected:
      return _createPropertyView(property, DetectedChannelPropertyView.new);
    case DevicesModulePropertyCategory.direction:
      return _createPropertyView(property, DirectionChannelPropertyView.new);
    case DevicesModulePropertyCategory.distance:
      return _createPropertyView(property, DistanceChannelPropertyView.new);
    case DevicesModulePropertyCategory.duration:
      return _createPropertyView(property, DurationChannelPropertyView.new);
    case DevicesModulePropertyCategory.event:
      return _createPropertyView(property, EventChannelPropertyView.new);
    case DevicesModulePropertyCategory.fault:
      return _createPropertyView(property, FaultChannelPropertyView.new);
    case DevicesModulePropertyCategory.faultDescription:
      return _createPropertyView(property, FaultDescriptionChannelPropertyView.new);
    case DevicesModulePropertyCategory.firmwareRevision:
      return _createPropertyView(
          property, FirmwareRevisionChannelPropertyView.new);
    case DevicesModulePropertyCategory.frequency:
      return _createPropertyView(property, FrequencyChannelPropertyView.new);
    case DevicesModulePropertyCategory.hardwareRevision:
      return _createPropertyView(
          property, HardwareRevisionChannelPropertyView.new);
    case DevicesModulePropertyCategory.hue:
      return _createPropertyView(property, HueChannelPropertyView.new);
    case DevicesModulePropertyCategory.humidity:
      return _createPropertyView(property, HumidityChannelPropertyView.new);
    case DevicesModulePropertyCategory.inUse:
      return _createPropertyView(property, InUseChannelPropertyView.new);
    case DevicesModulePropertyCategory.illuminance:
      return _createPropertyView(property, IlluminanceChannelPropertyView.new);
    case DevicesModulePropertyCategory.infrared:
      return _createPropertyView(property, InfraredChannelPropertyView.new);
    case DevicesModulePropertyCategory.lastEvent:
      return _createPropertyView(property, LastEventChannelPropertyView.new);
    case DevicesModulePropertyCategory.level:
      return _createPropertyView(property, LevelChannelPropertyView.new);
    case DevicesModulePropertyCategory.lifeRemaining:
      return _createPropertyView(property, LifeRemainingChannelPropertyView.new);
    case DevicesModulePropertyCategory.linkQuality:
      return _createPropertyView(property, LinkQualityChannelPropertyView.new);
    case DevicesModulePropertyCategory.locked:
      return _createPropertyView(property, LockedChannelPropertyView.new);
    case DevicesModulePropertyCategory.manufacturer:
      return _createPropertyView(property, ManufacturerChannelPropertyView.new);
    case DevicesModulePropertyCategory.mistLevel:
      return _createPropertyView(property, MistLevelChannelPropertyView.new);
    case DevicesModulePropertyCategory.mode:
      return _createPropertyView(property, ModeChannelPropertyView.new);
    case DevicesModulePropertyCategory.mute:
      return _createPropertyView(property, MuteChannelPropertyView.new);
    case DevicesModulePropertyCategory.model:
      return _createPropertyView(property, ModelChannelPropertyView.new);
    case DevicesModulePropertyCategory.naturalBreeze:
      return _createPropertyView(property, NaturalBreezeChannelPropertyView.new);
    case DevicesModulePropertyCategory.obstruction:
      return _createPropertyView(property, ObstructionChannelPropertyView.new);
    case DevicesModulePropertyCategory.valueOn:
      return _createPropertyView(property, OnChannelPropertyView.new);
    case DevicesModulePropertyCategory.overCurrent:
      return _createPropertyView(property, OverCurrentChannelPropertyView.new);
    case DevicesModulePropertyCategory.overPower:
      return _createPropertyView(property, OverPowerChannelPropertyView.new);
    case DevicesModulePropertyCategory.overVoltage:
      return _createPropertyView(property, OverVoltageChannelPropertyView.new);
    case DevicesModulePropertyCategory.pan:
      return _createPropertyView(property, PanChannelPropertyView.new);
    case DevicesModulePropertyCategory.peakLevel:
      return _createPropertyView(property, PeakLevelChannelPropertyView.new);
    case DevicesModulePropertyCategory.percentage:
      return _createPropertyView(property, PercentageChannelPropertyView.new);
    case DevicesModulePropertyCategory.position:
      return _createPropertyView(property, PositionChannelPropertyView.new);
    case DevicesModulePropertyCategory.power:
      return _createPropertyView(property, PowerChannelPropertyView.new);
    case DevicesModulePropertyCategory.pressure:
      return _createPropertyView(property, PressureChannelPropertyView.new);
    case DevicesModulePropertyCategory.rate:
      return _createPropertyView(property, RateChannelPropertyView.new);
    case DevicesModulePropertyCategory.remaining:
      return _createPropertyView(property, RemainingChannelPropertyView.new);
    case DevicesModulePropertyCategory.remoteKey:
      return _createPropertyView(property, RemoteKeyChannelPropertyView.new);
    case DevicesModulePropertyCategory.reset:
      return _createPropertyView(property, ResetChannelPropertyView.new);
    case DevicesModulePropertyCategory.saturation:
      return _createPropertyView(property, SaturationChannelPropertyView.new);
    case DevicesModulePropertyCategory.serialNumber:
      return _createPropertyView(property, SerialNumberChannelPropertyView.new);
    case DevicesModulePropertyCategory.source:
      return _createPropertyView(property, SourceChannelPropertyView.new);
    case DevicesModulePropertyCategory.sourceLabel:
      return _createPropertyView(property, SourceLabelChannelPropertyView.new);
    case DevicesModulePropertyCategory.speed:
      return _createPropertyView(property, SpeedChannelPropertyView.new);
    case DevicesModulePropertyCategory.status:
      return _createPropertyView(property, StatusChannelPropertyView.new);
    case DevicesModulePropertyCategory.swing:
      return _createPropertyView(property, SwingChannelPropertyView.new);
    case DevicesModulePropertyCategory.tampered:
      return _createPropertyView(property, TamperedChannelPropertyView.new);
    case DevicesModulePropertyCategory.temperature:
      return _createPropertyView(property, TemperatureChannelPropertyView.new);
    case DevicesModulePropertyCategory.tilt:
      return _createPropertyView(property, TiltChannelPropertyView.new);
    case DevicesModulePropertyCategory.timer:
      return _createPropertyView(property, TimerChannelPropertyView.new);
    case DevicesModulePropertyCategory.siren:
      return _createPropertyView(property, SirenChannelPropertyView.new);
    case DevicesModulePropertyCategory.state:
      return _createPropertyView(property, StateChannelPropertyView.new);
    case DevicesModulePropertyCategory.triggered:
      return _createPropertyView(property, TriggeredChannelPropertyView.new);
    case DevicesModulePropertyCategory.track:
      return _createPropertyView(property, TrackChannelPropertyView.new);
    case DevicesModulePropertyCategory.type:
      return _createPropertyView(property, TypeChannelPropertyView.new);
    case DevicesModulePropertyCategory.voltage:
      return _createPropertyView(property, VoltageChannelPropertyView.new);
    case DevicesModulePropertyCategory.volume:
      return _createPropertyView(property, VolumeChannelPropertyView.new);
    case DevicesModulePropertyCategory.warmMist:
      return _createPropertyView(property, WarmMistChannelPropertyView.new);
    case DevicesModulePropertyCategory.waterTankEmpty:
      return _createPropertyView(property, WaterTankEmptyChannelPropertyView.new);
    case DevicesModulePropertyCategory.waterTankFull:
      return _createPropertyView(property, WaterTankFullChannelPropertyView.new);
    case DevicesModulePropertyCategory.waterTankLevel:
      return _createPropertyView(property, WaterTankLevelChannelPropertyView.new);
    case DevicesModulePropertyCategory.zoom:
      return _createPropertyView(property, ZoomChannelPropertyView.new);
    default:
      return _createPropertyView(property, GenericChannelPropertyView.new);
  }
}

Map<DevicesModulePropertyCategory, IconData Function()>
    channelPropertyIconMappers = {
  DevicesModulePropertyCategory.generic: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.active: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.alarmState: () => MdiIcons.shieldAlertOutline,
  DevicesModulePropertyCategory.album: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.angle: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.artist: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.aqi: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.brightness: () => MdiIcons.weatherSunny,
  DevicesModulePropertyCategory.changeNeeded: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.childLock: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.colorBlue: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.colorGreen: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.colorRed: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.colorTemperature: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.colorWhite: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.command: () => MdiIcons.send,
  DevicesModulePropertyCategory.connectionType: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.consumption: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.current: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.concentration: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.defrostActive: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.detected: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.direction: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.distance: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.duration: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.event: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.fault: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.faultDescription: () => MdiIcons.alertCircleOutline,
  DevicesModulePropertyCategory.firmwareRevision: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.frequency: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.hardwareRevision: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.hue: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.humidity: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.illuminance: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.inUse: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.infrared: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.lastEvent: () => MdiIcons.calendarClock,
  DevicesModulePropertyCategory.level: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.lifeRemaining: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.linkQuality: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.locked: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.manufacturer: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.mistLevel: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.model: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.mode: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.naturalBreeze: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.obstruction: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.valueOn: () => MdiIcons.power,
  DevicesModulePropertyCategory.overCurrent: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.overVoltage: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.overPower: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.pan: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.peakLevel: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.percentage: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.position: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.power: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.pressure: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.rate: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.remaining: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.remoteKey: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.reset: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.saturation: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.siren: () => MdiIcons.alarmLight,
  DevicesModulePropertyCategory.serialNumber: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.source: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.sourceLabel: () => MdiIcons.label,
  DevicesModulePropertyCategory.state: () => MdiIcons.shieldCheck,
  DevicesModulePropertyCategory.speed: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.status: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.swing: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.tampered: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.temperature: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.tilt: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.timer: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.triggered: () => MdiIcons.alarmLightOutline,
  DevicesModulePropertyCategory.track: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.type: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.voltage: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.volume: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.warmMist: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.waterTankEmpty: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.waterTankFull: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.waterTankLevel: () => MdiIcons.databaseCog,
  DevicesModulePropertyCategory.zoom: () => MdiIcons.databaseCog,
};

IconData buildChannelPropertyIcon(DevicesModulePropertyCategory category) {
  final builder = channelPropertyIconMappers[category];

  if (builder != null) {
    return builder();
  } else {
    return MdiIcons.databaseCog;
  }
}
