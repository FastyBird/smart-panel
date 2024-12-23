import 'package:fastybird_smart_panel/core/utils/uuid.dart';

class DeviceControlDataModel extends ControlDataModel {
  final String _device;

  DeviceControlDataModel({
    required String device,
    required super.id,
    required super.name,
    super.createdAt,
    super.updatedAt,
  }) : _device = UuidUtils.validateUuid(device);

  String get device => _device;

  factory DeviceControlDataModel.fromJson(Map<String, dynamic> json) {
    return DeviceControlDataModel(
      device: json['device'],
      id: json['id'],
      name: json['name'],
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}

class ChannelControlDataModel extends ControlDataModel {
  final String _channel;

  ChannelControlDataModel({
    required String channel,
    required super.id,
    required super.name,
    super.createdAt,
    super.updatedAt,
  }) : _channel = UuidUtils.validateUuid(channel);

  String get channel => _channel;

  factory ChannelControlDataModel.fromJson(Map<String, dynamic> json) {
    return ChannelControlDataModel(
      channel: json['channel'],
      id: json['id'],
      name: json['name'],
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}

abstract class ControlDataModel {
  final String _id;

  final String _name;

  final DateTime? _createdAt;
  final DateTime? _updatedAt;

  ControlDataModel({
    required String id,
    required String name,
    DateTime? createdAt,
    DateTime? updatedAt,
  })  : _id = UuidUtils.validateUuid(id),
        _name = name,
        _createdAt = createdAt,
        _updatedAt = updatedAt;

  String get id => _id;

  String get name => _name;

  DateTime? get createdAt => _createdAt;

  DateTime? get updatedAt => _updatedAt;
}
