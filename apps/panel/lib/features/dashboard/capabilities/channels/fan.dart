import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class FanChannelCapability extends Capability with ChannelOnMixin {
  FanChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.on,
      );

  ChannelPropertyModel? get swingProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.swing,
      );

  ChannelPropertyModel? get speedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.speed,
      );

  ChannelPropertyModel? get directionProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.direction,
      );

  bool get hasSwing => swingProp != null;

  bool get swing {
    final ChannelPropertyModel? prop = swingProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }

  bool get hasSpeed => speedProp != null;

  double get speed {
    final ChannelPropertyModel? prop = speedProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    return 0;
  }

  double get minSpeed {
    final FormatType? format = speedProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxSpeed {
    final FormatType? format = speedProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }

  bool get hasDirection => directionProp != null;

  FanDirectionValue? get direction {
    final ChannelPropertyModel? prop = directionProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && FanDirectionValue.contains(value.value)) {
      return FanDirectionValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        FanDirectionValue.contains(defaultValue.value)) {
      return FanDirectionValue.fromValue(defaultValue.value);
    }

    return null;
  }
}
