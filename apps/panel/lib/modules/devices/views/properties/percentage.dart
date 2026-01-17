import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Property view for percentage values.
/// Supports both numeric (0-100) and enum (critical, low, medium, high, full) values.
class PercentageChannelPropertyView extends ChannelPropertyView {
  PercentageChannelPropertyView({
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

  /// Returns true if the value is a numeric percentage (0-100).
  bool get isNumeric => value is NumberValueType;

  /// Returns true if the value is an enum level (critical, low, medium, high, full).
  bool get isEnum => value is StringValueType;

  /// Returns the numeric percentage value (0-100) if available.
  int? get numericValue => value is NumberValueType ? (value as NumberValueType).value.toInt() : null;

  /// Returns the enum level value if available.
  String? get enumValue => value is StringValueType ? (value as StringValueType).value : null;
}
