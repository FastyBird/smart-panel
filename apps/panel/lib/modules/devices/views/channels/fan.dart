import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/direction.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/speed.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/swing.dart';

class FanChannelView extends ChannelView with ChannelOnMixin {
  FanChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  OnChannelPropertyView? get onProp =>
      properties.whereType<OnChannelPropertyView>().firstOrNull;

  SwingChannelPropertyView? get swingProp =>
      properties.whereType<SwingChannelPropertyView>().firstOrNull;

  SpeedChannelPropertyView? get speedProp =>
      properties.whereType<SpeedChannelPropertyView>().firstOrNull;

  DirectionChannelPropertyView? get directionProp =>
      properties.whereType<DirectionChannelPropertyView>().firstOrNull;

  bool get hasSwing => swingProp != null;

  bool get swing {
    final SwingChannelPropertyView? prop = swingProp;

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
    final SpeedChannelPropertyView? prop = speedProp;

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
    final DirectionChannelPropertyView? prop = directionProp;

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
