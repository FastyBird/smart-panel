import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

/// Property view for pressure values.
class PressureChannelPropertyView extends ChannelPropertyView {
  PressureChannelPropertyView({
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

  /// Returns the pressure value.
  num? get pressure => value is NumberValueType ? (value as NumberValueType).value : null;
}
