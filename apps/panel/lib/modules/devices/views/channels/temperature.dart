import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/temperature.dart';

class TemperatureChannelView extends ChannelView
    with ChannelTemperatureMixin, ChannelFaultMixin, ChannelActiveMixin {
  TemperatureChannelView({
    required super.channelModel,
    required super.properties,
  });

  @override
  TemperatureChannelPropertyView get temperatureProp =>
      properties.whereType<TemperatureChannelPropertyView>().first;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;
}
