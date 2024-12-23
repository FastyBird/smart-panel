import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class BatteryChannelDataModel extends ChannelDataModel
    with ChannelPercentageMixin, ChannelFaultMixin {
  BatteryChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.battery,
        );

  @override
  ChannelPropertyDataModel get percentageProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.percentage,
      );

  ChannelPropertyDataModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.status,
      );

  @override
  ChannelPropertyDataModel get faultProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.fault,
      );

  bool get isOk {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStateValue.contains(value.value)) {
      return value.value == BatteryStateValue.ok.value;
    }

    return false;
  }

  bool get isLow {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStateValue.contains(value.value)) {
      return value.value == BatteryStateValue.low.value;
    }

    return false;
  }

  bool get isCharging {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && BatteryStateValue.contains(value.value)) {
      return value.value == BatteryStateValue.charging.value;
    }

    return false;
  }

  factory BatteryChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return BatteryChannelDataModel(
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
