import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Property view for duration values.
/// Supports ushort and uint data types.
class DurationChannelPropertyView extends ChannelPropertyView {
  DurationChannelPropertyView({
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
    super.valueState,
  });

  /// Returns the duration value in the specified unit.
  int? get duration => value is NumberValueType ? (value as NumberValueType).value.toInt() : null;
}
