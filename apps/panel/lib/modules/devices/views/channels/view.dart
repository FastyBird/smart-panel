import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';

abstract class ChannelView {
  final ChannelModel _channelModel;
  final List<ChannelPropertyView> _properties;

  ChannelView({
    required ChannelModel channelModel,
    required List<ChannelPropertyView> properties,
  })  : _channelModel = channelModel,
        _properties = properties;

  ChannelModel get channelModel => _channelModel;

  List<ChannelPropertyView> get properties => _properties;

  String get id => channelModel.id;

  ChannelCategory get category => channelModel.category;

  String get name => channelModel.name ?? channelModel.category.value;

  ChannelPropertyView? getProperty(String id) {
    return _properties.firstWhere((property) => property.id == id);
  }
}
