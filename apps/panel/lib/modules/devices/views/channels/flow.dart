import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/rate.dart';

class FlowChannelView extends ChannelView
    with ChannelActiveMixin, ChannelFaultMixin {
  FlowChannelView({
    required super.channelModel,
    required super.properties,
  });

  RateChannelPropertyView get rateProp =>
      properties.whereType<RateChannelPropertyView>().first;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  double get rate {
    final ValueType? value = rateProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }
}
