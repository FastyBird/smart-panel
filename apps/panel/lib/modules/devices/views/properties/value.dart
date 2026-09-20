import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

class ValueChannelPropertyView extends ChannelPropertyView {
  ValueChannelPropertyView({
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

  num? get valueNum => value is NumberValueType
      ? (value as NumberValueType).value
      : value is StringValueType
          ? num.tryParse((value as StringValueType).value)
          : null;

  dynamic get propertyValue => value is NumberValueType
      ? (value as NumberValueType).value
      : value is StringValueType
          ? (value as StringValueType).value
          : null;
}
