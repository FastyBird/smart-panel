import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/mapper.dart';
import 'package:fastybird_smart_panel/core/utils/icon.dart';

class DeviceDetailPageModel extends PageModel {
  final String _device;

  DeviceDetailPageModel({
    required String device,
    required super.id,
    required super.title,
    required super.icon,
    super.order,
    super.showTopBar,
    super.displays,
    super.createdAt,
    super.updatedAt,
  })  : _device = UuidUtils.validateUuid(device),
        super(
          type: pagesDeviceDetailType,
        );

  String get device => _device;

  factory DeviceDetailPageModel.fromJson(Map<String, dynamic> json) {
    return DeviceDetailPageModel(
      device: UuidUtils.validateUuid(json['device']),
      id: UuidUtils.validateUuid(json['id']),
      title: json['title'],
      icon: resolveIconNullable(json['icon'] is String ? json['icon'] : null),
      order: json['order'],
      showTopBar: json['show_top_bar'],
      displays: json['displays'] != null && json['displays'] is List
          ? (json['displays'] as List).map((e) => e.toString()).toList()
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
