import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/volume.dart';

class MicrophoneChannelView extends ChannelView
    with ChannelActiveMixin, ChannelVolumeMixin {
  MicrophoneChannelView({
    required super.channelModel,
    required super.properties,
  });

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  VolumeChannelPropertyView? get volumeProp =>
      properties.whereType<VolumeChannelPropertyView>().firstOrNull;
}
