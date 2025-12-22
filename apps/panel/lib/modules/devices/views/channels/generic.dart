import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';

class GenericChannelView extends ChannelView {
  GenericChannelView({
    required super.channelModel,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });
}
