import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

class StateChannelPropertyView extends ChannelPropertyView {
  StateChannelPropertyView({
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

  dynamic get state => value is StringValueType
      ? (value as StringValueType).value
      : value is BooleanValueType
          ? (value as BooleanValueType).value
          : null;

  bool? get stateBool {
    final val = value;
    if (val is BooleanValueType) {
      return val.value;
    }
    if (val is StringValueType) {
      final str = val.value.toLowerCase();
      if (str == 'true' || str == '1' || str == 'on') {
        return true;
      }
      if (str == 'false' || str == '0' || str == 'off') {
        return false;
      }
    }
    return null;
  }

  String? get stateString => value is StringValueType
      ? (value as StringValueType).value
      : value is BooleanValueType
          ? (value as BooleanValueType).value.toString()
          : null;
}
