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
  LifeRemainingChannelPropertyView? get lifeRemainingProp =>
      properties.whereType<LifeRemainingChannelPropertyView>().firstOrNull;

  StatusChannelPropertyView? get statusProp =>
      properties.whereType<StatusChannelPropertyView>().firstOrNull;

  bool get hasLifeRemaining => lifeRemainingProp != null;

  bool get hasStatus => statusProp != null;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  int get lifeRemaining {
    final prop = lifeRemainingProp;
    if (prop == null) return 100;

    final ValueType? value = prop.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    // Handle string values (backend may return numbers as strings)
    if (value is StringValueType) {
      final parsed = int.tryParse(value.value);
      if (parsed != null) {
        return parsed;
      }
    }

    final ValueType? defaultValue = prop.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    if (defaultValue is StringValueType) {
      final parsed = int.tryParse(defaultValue.value);
      if (parsed != null) {
        return parsed;
      }
    }

    return 100;
  }

  int get minLifeRemaining {
    final FormatType? format = lifeRemainingProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxLifeRemaining {
    final FormatType? format = lifeRemainingProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 100;
  }

  FilterStatusValue? get status {
    final prop = statusProp;
    if (prop == null) return null;

    final ValueType? value = prop.value;

    if (value is StringValueType && FilterStatusValue.contains(value.value)) {
      return FilterStatusValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop.defaultValue;

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
