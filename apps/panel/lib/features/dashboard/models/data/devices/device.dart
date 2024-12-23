import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/cupertino.dart';

abstract class DeviceDataModel {
  final String _id;

  final DeviceCategoryType _category;

  final String _name;
  final String? _description;
  final IconData? _icon;

  final List<DeviceControlDataModel> _controls;
  final List<ChannelDataModel> _channels;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  DeviceDataModel({
    required String id,
    DeviceCategoryType category = DeviceCategoryType.generic,
    required String name,
    String? description,
    IconData? icon,
    List<DeviceControlDataModel> controls = const [],
    List<ChannelDataModel> channels = const [],
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _category = category,
        _name = name,
        _description = description,
        _icon = icon,
        _controls = controls,
        _channels = channels,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  DeviceCategoryType get category => _category;

  String get name => _name;

  String? get description => _description;

  IconData? get icon => _icon;

  List<DeviceControlDataModel> get controls => _controls;

  List<ChannelDataModel> get channels => _channels;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;

  bool? get isOn => null;

  set channel(ChannelDataModel channel) {
    final int index = _channels.indexWhere(
      (item) => item.id == channel.id,
    );

    if (index == -1) {
      return;
    }

    _channels[index] = channel;
  }
}
