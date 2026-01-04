import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';

class GenericChannelView extends ChannelView {
  GenericChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });
}
