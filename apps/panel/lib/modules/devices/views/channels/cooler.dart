import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';

class CoolerChannelView extends ChannelView with ChannelTemperatureMixin {
  CoolerChannelView({
    required super.channelModel,
    required super.properties,
  });

  @override
  TemperatureChannelPropertyView get temperatureProp =>
      properties.whereType<TemperatureChannelPropertyView>().first;

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  bool get isCooling {
    final value = statusProp.value;

    return value is BooleanValueType ? value.value : false;
  }
}
