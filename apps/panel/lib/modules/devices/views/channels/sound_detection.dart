import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/sound_type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class SoundDetectionChannelView extends ChannelView
    with ChannelDetectedMixin, ChannelActiveMixin, ChannelTamperedMixin {
  SoundDetectionChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  DetectedChannelPropertyView get detectedProp =>
      properties.whereType<DetectedChannelPropertyView>().first;

  SoundTypeChannelPropertyView get soundTypeProp =>
      properties.whereType<SoundTypeChannelPropertyView>().first;

  /// Kind of sound the channel detects (e.g. glass_break), if reported.
  String? get soundType => soundTypeProp.soundTypeValue;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;
}
