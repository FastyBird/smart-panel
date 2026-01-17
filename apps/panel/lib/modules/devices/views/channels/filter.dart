import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/life_remaining.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

class FilterChannelView extends ChannelView with ChannelFaultMixin {
  FilterChannelView({
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

  /// Life remaining property
  LifeRemainingChannelPropertyView get lifeRemainingProp =>
      properties.whereType<LifeRemainingChannelPropertyView>().first;

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  int get lifeRemaining {
    final ValueType? value = lifeRemainingProp.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = lifeRemainingProp.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 100;
  }

  int get minLifeRemaining {
    final FormatType? format = lifeRemainingProp.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxLifeRemaining {
    final FormatType? format = lifeRemainingProp.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }

  FilterStatusValue? get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && FilterStatusValue.contains(value.value)) {
      return FilterStatusValue.fromValue(value.value);
    }

    final ValueType? defaultValue = statusProp.defaultValue;

    if (defaultValue is StringValueType &&
        FilterStatusValue.contains(defaultValue.value)) {
      return FilterStatusValue.fromValue(defaultValue.value);
    }

    return null;
  }

  bool get needsReplacement {
    return status == FilterStatusValue.replaceNow ||
        status == FilterStatusValue.replaceSoon;
  }

  bool get isGood {
    return status == FilterStatusValue.good;
  }
}
