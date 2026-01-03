import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/actions/action.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/constants.dart';

class LocalActionModel extends ActionModel {
  final String _deviceId;
  final String? _channelId;
  final String _propertyId;
  final dynamic _value;

  LocalActionModel({
    required super.id,
    required super.scene,
    required super.order,
    required super.enabled,
    required String deviceId,
    String? channelId,
    required String propertyId,
    required dynamic value,
    super.createdAt,
    super.updatedAt,
  })  : _deviceId = UuidUtils.validateUuid(deviceId),
        _channelId = channelId != null ? UuidUtils.validateUuid(channelId) : null,
        _propertyId = UuidUtils.validateUuid(propertyId),
        _value = value,
        super(type: localActionType);

  String get deviceId => _deviceId;

  String? get channelId => _channelId;

  String get propertyId => _propertyId;

  dynamic get value => _value;

  factory LocalActionModel.fromJson(Map<String, dynamic> json) {
    return LocalActionModel(
      id: UuidUtils.validateUuid(json['id']),
      scene: UuidUtils.validateUuid(json['scene']),
      order: json['order'] ?? 0,
      enabled: json['enabled'] ?? true,
      deviceId: UuidUtils.validateUuid(json['device_id']),
      channelId: json['channel_id'],
      propertyId: UuidUtils.validateUuid(json['property_id']),
      value: json['value'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}
