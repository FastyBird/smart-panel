import 'package:fastybird_smart_panel/modules/devices/models/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';

abstract class Capability {
  final ChannelModel _channel;
  final List<ChannelPropertyModel> _properties;

  Capability({
    required ChannelModel channel,
    required List<ChannelPropertyModel> properties,
  })  : _channel = channel,
        _properties = properties;

  ChannelModel get channel => _channel;

  List<ChannelPropertyModel> get properties => _properties;

  String get id => channel.id;

  String get name => channel.name ?? channel.category.value;

  ChannelPropertyModel? getProperty(String id) {
    return _properties.firstWhere((property) => property.id == id);
  }
}
