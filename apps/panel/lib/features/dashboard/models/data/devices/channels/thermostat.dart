import 'package:fastybird_smart_panel/core/utils/uuid.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';

class ThermostatChannelDataModel extends ChannelDataModel {
  ThermostatChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
    super.invalid,
  }) : super(
          category: ChannelCategoryType.thermostat,
        );

  factory ThermostatChannelDataModel.fromJson(Map<String, dynamic> json) {
    return ThermostatChannelDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      device: json['device'],
      controls: UuidUtils.validateUuidList(
        List<String>.from(json['controls'] ?? []),
      ),
      properties: UuidUtils.validateUuidList(
        List<String>.from(json['properties'] ?? []),
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
