import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/event.dart';

class ButtonChannelView extends ChannelView
    with ChannelDetectedMixin, ChannelActiveMixin {
  ButtonChannelView({
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

  EventChannelPropertyView get eventProp =>
      properties.whereType<EventChannelPropertyView>().first;

  @override
  DetectedChannelPropertyView? get detectedProp =>
      properties.whereType<DetectedChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  bool get hasEvent =>
      properties.whereType<EventChannelPropertyView>().isNotEmpty;

  String? get event =>
      properties.whereType<EventChannelPropertyView>().firstOrNull?.event;
}
