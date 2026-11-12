import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/object_type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class ObjectDetectionChannelView extends ChannelView
    with ChannelDetectedMixin, ChannelActiveMixin, ChannelTamperedMixin {
  ObjectDetectionChannelView({
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

  ObjectTypeChannelPropertyView get objectTypeProp =>
      properties.whereType<ObjectTypeChannelPropertyView>().first;

  /// Kind of object the channel detects (e.g. person), if reported.
  String? get objectType => objectTypeProp.objectTypeValue;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;
}
