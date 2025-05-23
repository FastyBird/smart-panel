import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';

class SwitcherChannelView extends ChannelView with ChannelOnMixin {
  SwitcherChannelView({
    required super.channelModel,
    required super.properties,
  });

  @override
  OnChannelPropertyView? get onProp =>
      properties.whereType<OnChannelPropertyView>().firstOrNull;
}
