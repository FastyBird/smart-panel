import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';

abstract class DeviceChannelDataSourceModel extends DataSourceModel {
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
    required super.parent,
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
}

class PageDeviceChannelDataSourceModel extends DeviceChannelDataSourceModel {
  PageDeviceChannelDataSourceModel({
    required super.device,
    required super.channel,
    required super.property,
    super.icon,
    required super.id,
    required super.parent,
    super.createdAt,
    super.updatedAt,
  });

  factory PageDeviceChannelDataSourceModel.fromJson(Map<String, dynamic> json) {
    return PageDeviceChannelDataSourceModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
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

class CardDeviceChannelDataSourceModel extends DeviceChannelDataSourceModel {
  CardDeviceChannelDataSourceModel({
    required super.device,
    required super.channel,
    required super.property,
    super.icon,
    required super.id,
    required super.parent,
    super.createdAt,
    super.updatedAt,
  });

  factory CardDeviceChannelDataSourceModel.fromJson(Map<String, dynamic> json) {
    return CardDeviceChannelDataSourceModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      device: UuidUtils.validateUuid(json['device']),
      channel: UuidUtils.validateUuid(json['channel']),
      property: UuidUtils.validateUuid(json['property']),
      icon: json['icon'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

class TileDeviceChannelDataSourceModel extends DeviceChannelDataSourceModel {
  TileDeviceChannelDataSourceModel({
    required super.device,
    required super.channel,
    required super.property,
    super.icon,
    required super.id,
    required super.parent,
    super.createdAt,
    super.updatedAt,
  });

  factory TileDeviceChannelDataSourceModel.fromJson(Map<String, dynamic> json) {
    return TileDeviceChannelDataSourceModel(
      id: UuidUtils.validateUuid(json['id']),
      parent: UuidUtils.validateUuid(json['parent']),
      device: UuidUtils.validateUuid(json['device']),
      channel: UuidUtils.validateUuid(json['channel']),
      property: UuidUtils.validateUuid(json['property']),
      icon: json['icon'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
