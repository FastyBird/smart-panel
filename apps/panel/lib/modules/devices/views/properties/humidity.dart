import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

class HumidityChannelPropertyView extends ChannelPropertyView {
  HumidityChannelPropertyView({
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
}
