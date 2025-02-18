import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';

abstract class ChannelCapability<TChannel extends ChannelDataModel> {
  final TChannel _channel;
  final List<ChannelPropertyDataModel> _properties;

  ChannelCapability({
    required TChannel channel,
    required List<ChannelPropertyDataModel> properties,
  })  : _channel = channel,
        _properties = properties;

  TChannel get channel => _channel;

  List<ChannelPropertyDataModel> get properties => _properties;

  String get name => channel.name ?? channel.category.value;
}
