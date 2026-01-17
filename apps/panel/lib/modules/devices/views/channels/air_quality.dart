import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/measured.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

class AirQualityChannelView extends ChannelView
    with ChannelActiveMixin, ChannelFaultMixin {
  AirQualityChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  /// AQI (Air Quality Index) value property - uses measured property view for numeric AQI
  MeasuredChannelPropertyView? get aqiProp =>
      properties.whereType<MeasuredChannelPropertyView>().firstOrNull;

  /// Level property for air quality level classification
  LevelChannelPropertyView? get levelProp =>
      properties.whereType<LevelChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  bool get hasAqi => aqiProp != null;

  int get aqi {
    final MeasuredChannelPropertyView? prop = aqiProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  bool get hasLevel => levelProp != null;

  AirQualityLevelValue? get level {
    final LevelChannelPropertyView? prop = levelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && AirQualityLevelValue.contains(value.value)) {
      return AirQualityLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        AirQualityLevelValue.contains(defaultValue.value)) {
      return AirQualityLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }
}
