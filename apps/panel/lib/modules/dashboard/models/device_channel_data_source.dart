import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';

class DeviceChannelDataSourceModel extends DataSourceModel {
  final String _device;
  final String _channel;
  final String _property;

  final IconData? _icon;

  DeviceChannelDataSourceModel({
    required String device,
    required String channel,
    required String property,
    IconData? icon,
    required super.id,
    required super.parentType,
    required super.parentId,
    super.createdAt,
    super.updatedAt,
  })  : _device = UuidUtils.validateUuid(device),
        _channel = UuidUtils.validateUuid(channel),
        _property = UuidUtils.validateUuid(property),
        _icon = icon,
        super(
          type: DataSourceType.deviceChannel,
        );

  String get device => _device;

  String get channel => _channel;

  String get property => _property;

  IconData? get icon => _icon;

  factory DeviceChannelDataSourceModel.fromJson(Map<String, dynamic> json) {
    return DeviceChannelDataSourceModel(
      id: UuidUtils.validateUuid(json['id']),
      parentType: json['parent']['type'],
      parentId: UuidUtils.validateUuid(json['parent']['id']),
      device: UuidUtils.validateUuid(json['device']),
      channel: UuidUtils.validateUuid(json['channel']),
      property: UuidUtils.validateUuid(json['property']),
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
