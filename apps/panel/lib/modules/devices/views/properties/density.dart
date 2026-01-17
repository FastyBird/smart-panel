import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Property view for density values.
/// Supports float and uint data types.
class DensityChannelPropertyView extends ChannelPropertyView {
  DensityChannelPropertyView({
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

  /// Returns the density value.
  num? get density => value is NumberValueType ? (value as NumberValueType).value : null;
}
