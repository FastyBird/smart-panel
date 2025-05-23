import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/density.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/peak_level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class CarbonMonoxideChannelView extends ChannelView
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelPeakLevelMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  CarbonMonoxideChannelView({
    required super.channelModel,
    required super.properties,
  });

  @override
  DetectedChannelPropertyView? get detectedProp =>
      properties.whereType<DetectedChannelPropertyView>().firstOrNull;

  @override
  DensityChannelPropertyView? get densityProp =>
      properties.whereType<DensityChannelPropertyView>().firstOrNull;

  @override
  PeakLevelChannelPropertyView? get peakLevelProp =>
      properties.whereType<PeakLevelChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;
}
