import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

class ColorTemperatureChannelPropertyView extends ChannelPropertyView {
  ColorTemperatureChannelPropertyView({
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

  int? get colorTemperature => value is NumberValueType ? (value as NumberValueType).value.toInt() : null;
}
