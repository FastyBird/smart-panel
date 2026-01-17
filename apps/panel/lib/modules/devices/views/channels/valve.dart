import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/duration.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/remaining.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/type.dart';

class ValveChannelView extends ChannelView
    with ChannelOnMixin, ChannelFaultMixin {
  ValveChannelView({
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

  TypeChannelPropertyView get typeProp =>
      properties.whereType<TypeChannelPropertyView>().first;

  DurationChannelPropertyView? get durationProp =>
      properties.whereType<DurationChannelPropertyView>().firstOrNull;

  RemainingChannelPropertyView? get remainingProp =>
      properties.whereType<RemainingChannelPropertyView>().firstOrNull;

  ModeChannelPropertyView? get modeProp =>
      properties.whereType<ModeChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  ValveTypeValue get valveType {
    final ValueType? value = typeProp.value;

    if (value is StringValueType && ValveTypeValue.contains(value.value)) {
      ValveTypeValue? valveTypeValue = ValveTypeValue.fromValue(value.value);

      if (valveTypeValue != null) {
        return valveTypeValue;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${typeProp.category.json}',
    );
  }

  bool get hasDuration => durationProp != null;

  int get duration {
    final DurationChannelPropertyView? prop = durationProp;

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

  int get minDuration {
    final FormatType? format = durationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxDuration {
    final FormatType? format = durationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 3600;
  }

  bool get hasRemaining => remainingProp != null;

  int get remaining {
    final RemainingChannelPropertyView? prop = remainingProp;

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

  int get minRemaining {
    final FormatType? format = remainingProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxRemaining {
    final FormatType? format = remainingProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 3600;
  }

  bool get hasMode => modeProp != null;

  ValveModeValue get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && ValveModeValue.contains(value.value)) {
      ValveModeValue? type = ValveModeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${modeProp?.category.json}',
    );
  }

  List<ValveModeValue> get availableModes {
    final ModeChannelPropertyView? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => ValveModeValue.fromValue(item))
          .whereType<ValveModeValue>()
          .toList();
    }

    return [];
  }
}
