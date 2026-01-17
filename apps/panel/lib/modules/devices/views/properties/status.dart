import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Property view for status values.
/// Supports both boolean and enum data types.
class StatusChannelPropertyView extends ChannelPropertyView {
  StatusChannelPropertyView({
    required super.id,
    required super.type,
    required super.channel,
    super.category,
    super.name,
    super.permission,
    super.dataType,
    super.unit,
    super.format,
    super.invalid,
    super.step,
    super.defaultValue,
    super.value,
  });

  /// Returns true if the value is boolean.
  bool get isBoolean => value is BooleanValueType;

  /// Returns true if the value is an enum.
  bool get isEnum => value is StringValueType;

  /// Returns the boolean status value if available.
  bool? get booleanValue => value is BooleanValueType ? (value as BooleanValueType).value : null;

  /// Returns the enum status value if available.
  String? get enumValue => value is StringValueType ? (value as StringValueType).value : null;
}
