import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class ElectricalPowerChannelDataModel extends ChannelDataModel
    with ChannelFaultMixin, ChannelActiveMixin {
  ElectricalPowerChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.electricalPower,
        );

  ChannelPropertyDataModel get powerProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.power,
      );

  ChannelPropertyDataModel get voltageProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.voltage,
      );

  ChannelPropertyDataModel get currentProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.current,
      );

  ChannelPropertyDataModel get frequencyProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.frequency,
      );

  ChannelPropertyDataModel? get overCurrentProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.overCurrent,
      );

  ChannelPropertyDataModel? get overVoltageProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.overVoltage,
      );

  @override
  ChannelPropertyDataModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

  double get power {
    final ValueType? value = powerProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get voltage {
    final ValueType? value = voltageProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get current {
    final ValueType? value = currentProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  double get frequency {
    final ValueType? value = frequencyProp.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    return 0.0;
  }

  bool get hasOverCurrent => overCurrentProp != null;

  bool get isOverCurrent {
    final ChannelPropertyDataModel? prop = overCurrentProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }

  bool get hasOverVoltage => overVoltageProp != null;

  bool get isOverVoltage {
    final ChannelPropertyDataModel? prop = overVoltageProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    return false;
  }

  factory ElectricalPowerChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return ElectricalPowerChannelDataModel(
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
