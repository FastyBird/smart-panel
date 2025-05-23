import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:flutter/material.dart';

abstract class DeviceView {
  final DeviceModel _deviceModel;
  final List<ChannelView> _channels;

  DeviceView({
    required DeviceModel deviceModel,
    required List<ChannelView> channels,
  })  : _deviceModel = deviceModel,
        _channels = channels;

  DeviceModel get deviceModel => _deviceModel;

  List<ChannelView> get channels => _channels;

  String get id => deviceModel.id;

  String get name => deviceModel.name;

  IconData? get icon => deviceModel.icon;

  bool? get isOn => null;

  DeviceCategory get category => deviceModel.category;

  ChannelView? getChannel(String id) {
    return _channels.firstWhereOrNull((channel) => channel.id == id);
  }
}
