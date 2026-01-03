import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:flutter/material.dart';

class DeviceChannelDataSourceView extends DataSourceView {
  final String _device;
  final String _channel;
  final String _property;
  final IconData? _icon;

  DeviceChannelDataSourceView({
    required super.id,
    required super.type,
    required super.parentType,
    required super.parentId,
    required String device,
    required String channel,
    required String property,
    IconData? icon,
  })  : _device = device,
        _channel = channel,
        _property = property,
        _icon = icon;

  String get device => _device;

  String get channel => _channel;

  String get property => _property;

  IconData? get icon => _icon;
}
