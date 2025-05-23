import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class DeviceDetailPageModel extends PageModel {
  final String _device;

  DeviceDetailPageModel({
    required String device,
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.createdAt,
    super.updatedAt,
  })  : _device = UuidUtils.validateUuid(device),
        super(
          type: PageType.deviceDetail,
        );

  String get device => _device;

  factory DeviceDetailPageModel.fromJson(Map<String, dynamic> json) {
    return DeviceDetailPageModel(
      device: UuidUtils.validateUuid(json['device']),
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: json['icon'] != null && json['icon'] is String
          ? MdiIcons.fromString(json['icon'])
          : null,
      order: json['order'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
