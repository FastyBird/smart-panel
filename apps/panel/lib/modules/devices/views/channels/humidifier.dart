import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/humidity.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

class HumidifierChannelView extends ChannelView
    with ChannelOnMixin, ChannelFaultMixin {
  HumidifierChannelView({
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

  @override
  OnChannelPropertyView? get onProp =>
      properties.whereType<OnChannelPropertyView>().firstOrNull;

  HumidityChannelPropertyView get humidityProp =>
      properties.whereType<HumidityChannelPropertyView>().first;

  ModeChannelPropertyView? get modeProp =>
      properties.whereType<ModeChannelPropertyView>().firstOrNull;

  StatusChannelPropertyView? get statusProp =>
      properties.whereType<StatusChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  int get humidity {
    final ValueType? value = humidityProp.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = humidityProp.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minHumidity {
    final FormatType? format = humidityProp.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxHumidity {
    final FormatType? format = humidityProp.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }

  bool get hasMode => modeProp != null;

  HumidifierModeValue? get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && HumidifierModeValue.contains(value.value)) {
      return HumidifierModeValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        HumidifierModeValue.contains(defaultValue.value)) {
      return HumidifierModeValue.fromValue(defaultValue.value);
    }

    return null;
  }

  bool get hasStatus => statusProp != null;

  HumidifierStatusValue? get status {
    final StatusChannelPropertyView? prop = statusProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        HumidifierStatusValue.contains(value.value)) {
      return HumidifierStatusValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        HumidifierStatusValue.contains(defaultValue.value)) {
      return HumidifierStatusValue.fromValue(defaultValue.value);
    }

    return null;
  }

  bool get isHumidifying {
    return status == HumidifierStatusValue.humidifying;
  }
}
