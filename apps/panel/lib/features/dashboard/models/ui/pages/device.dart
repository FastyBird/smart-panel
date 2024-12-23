import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/material.dart';

class DevicePageModel extends PageModel {
  final String _device;

  DevicePageModel({
    required String device,
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.createdAt,
    super.updatedAt,
  })  : _device = UuidUtils.validateUuid(device),
        super(
          type: PageType.device,
        );

  String get device => _device;

  factory DevicePageModel.fromJson(Map<String, dynamic> json) {
    return DevicePageModel(
      device: UuidUtils.validateUuid(json['device']),
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: json['icon'] != null
          ? IconData(json['icon'], fontFamily: 'MaterialIcons')
          : null,
      order: json['order'],
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }
}
