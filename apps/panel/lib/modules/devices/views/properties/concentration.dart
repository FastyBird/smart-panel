import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Property view for concentration values.
/// Supports float and uint data types.
class ConcentrationChannelPropertyView extends ChannelPropertyView {
  ConcentrationChannelPropertyView({
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

  /// Returns the concentration value.
  num? get concentration => value is NumberValueType ? (value as NumberValueType).value : null;
}
