import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Property view for mist level values.
/// Supports both numeric and enum values.
class MistLevelChannelPropertyView extends ChannelPropertyView {
  MistLevelChannelPropertyView({
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

  /// Returns true if the value is numeric.
  bool get isNumeric => value is NumberValueType;

  /// Returns true if the value is an enum level.
  bool get isEnum => value is StringValueType;

  /// Returns the numeric mist level value if available.
  int? get numericValue => value is NumberValueType ? (value as NumberValueType).value.toInt() : null;

  /// Returns the enum level value if available.
  String? get enumValue => value is StringValueType ? (value as StringValueType).value : null;
}
