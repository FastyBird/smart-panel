import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/get.dart';
import 'package:material_symbols_icons/symbols.dart';

class HeaterDeviceDataModel extends DeviceDataModel {
  HeaterDeviceDataModel({
    required super.id,
    required super.name,
    super.description,
    super.icon,
    super.controls,
    super.channels,
    super.createdAt,
    super.updatedAt,
    super.invalid,
  }) : super(
          category: DeviceCategoryType.heater,
        );

  @override
  IconData get icon => super.icon ?? Symbols.water_heater;

  factory HeaterDeviceDataModel.fromJson(Map<String, dynamic> json) {
    return HeaterDeviceDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      icon: json['icon'] != null && json['icon'] is String
          ? SymbolsGet.get(
              json['icon'],
              SymbolStyle.outlined,
            )
          : null,
      controls: UuidUtils.validateUuidList(
        List<String>.from(json['controls'] ?? []),
      ),
      channels: UuidUtils.validateUuidList(
        List<String>.from(json['channels'] ?? []),
      ),
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
