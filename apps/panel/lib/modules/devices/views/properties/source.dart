import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Property view for source values.
/// Supports both string and enum data types.
class SourceChannelPropertyView extends ChannelPropertyView {
  SourceChannelPropertyView({
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
    super.valueState,
  });

  /// Returns the source value as string.
  String? get source => value is StringValueType ? (value as StringValueType).value : null;
}
