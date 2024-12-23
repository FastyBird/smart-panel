import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';

class DeviceTileDataSourceModel extends TileDataSourceModel {
  final String _device;
  final String _channel;
  final String _property;

  DeviceTileDataSourceModel({
    required String device,
    required String channel,
    required String property,
    required super.id,
    required super.tile,
    super.createdAt,
    super.updatedAt,
  })  : _device = UuidUtils.validateUuid(device),
        _channel = UuidUtils.validateUuid(channel),
        _property = UuidUtils.validateUuid(property),
        super(
          type: TileDataSourceType.deviceChannel,
        );

  String get device => _device;

  String get channel => _channel;

  String get property => _property;

  factory DeviceTileDataSourceModel.fromJson(Map<String, dynamic> json) {
    return DeviceTileDataSourceModel(
      device: UuidUtils.validateUuid(json['device']),
      channel: UuidUtils.validateUuid(json['channel']),
      property: UuidUtils.validateUuid(json['property']),
      id: UuidUtils.validateUuid(json['id']),
      tile: UuidUtils.validateUuid(json['tile']),
      createdAt: json['created_at'],
      updatedAt: json['updated_at'],
    );
  }
}
