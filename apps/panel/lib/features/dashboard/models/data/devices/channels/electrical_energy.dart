import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class ElectricalEnergyChannelDataModel extends ChannelDataModel
    with ChannelFaultMixin, ChannelActiveMixin {
  ElectricalEnergyChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.electricalEnergy,
        );

  ChannelPropertyDataModel get consumptionProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.consumption,
      );

  ChannelPropertyDataModel get rateProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.rate,
      );

  @override
  ChannelPropertyDataModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

  double get consumption {
    final ValueType? value = consumptionProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get rate {
    final ValueType? value = rateProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  factory ElectricalEnergyChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return ElectricalEnergyChannelDataModel(
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
