import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

class PeakLevelChannelPropertyView extends ChannelPropertyView {
  PeakLevelChannelPropertyView({
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

  num? get peakLevel => value is NumberValueType ? (value as NumberValueType).value : null;
}
