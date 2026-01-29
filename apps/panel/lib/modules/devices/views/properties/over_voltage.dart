import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

class OverVoltageChannelPropertyView extends ChannelPropertyView {
  OverVoltageChannelPropertyView({
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

  bool? get isOverVoltage => value is BooleanValueType ? (value as BooleanValueType).value : null;
}
