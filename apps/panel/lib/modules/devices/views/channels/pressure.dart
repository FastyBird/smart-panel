import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/measured.dart';

class PressureChannelView extends ChannelView
    with ChannelMeasuredMixin, ChannelActiveMixin, ChannelFaultMixin {
  PressureChannelView({
    required super.channelModel,
    required super.properties,
  });

  @override
  MeasuredChannelPropertyView? get measuredProp =>
      properties.whereType<MeasuredChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;
}
