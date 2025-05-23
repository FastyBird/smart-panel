import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/modules/devices/models/model.dart';

class DeviceControlModel extends ControlModel {
  final String _device;

  DeviceControlModel({
    required String device,
    required super.id,
    required super.name,
    super.createdAt,
    super.updatedAt,
  }) : _device = UuidUtils.validateUuid(device);

  String get device => _device;

  factory DeviceControlModel.fromJson(Map<String, dynamic> json) {
    return DeviceControlModel(
      device: json['device'],
      id: json['id'],
      name: json['name'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

class ChannelControlDataModel extends ControlModel {
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
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'])
          : null,
    );
  }
}

abstract class ControlModel extends Model {
  final String _name;

  ControlModel({
    required super.id,
    required String name,
    super.createdAt,
    super.updatedAt,
  }) : _name = name;

  String get name => _name;
}
