import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';

class SmokeChannelDataModel extends ChannelDataModel
    with
        ChannelDetectedMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  SmokeChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.smoke,
        );

  @override
  ChannelPropertyDataModel get detectedProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.detected,
      );

  @override
  ChannelPropertyDataModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

  @override
  ChannelPropertyDataModel? get tamperedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.tampered,
      );

  factory SmokeChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return SmokeChannelDataModel(
      id: json['id'],
      name: json['name'],
      description: json['description'],
      device: json['device'],
      properties: properties,
      controls: controls,
      createdAt:
          json['createdAt'] != null ? DateTime.parse(json['createdAt']) : null,
      updatedAt:
          json['updatedAt'] != null ? DateTime.parse(json['updatedAt']) : null,
    );
  }
}
