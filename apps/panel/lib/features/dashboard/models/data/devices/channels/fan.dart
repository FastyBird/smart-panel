import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class FanChannelDataModel extends ChannelDataModel with ChannelOnMixin {
  FanChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.fan,
        );

  @override
  ChannelPropertyDataModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.on,
      );

  ChannelPropertyDataModel? get swingProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.swing,
      );

  ChannelPropertyDataModel? get speedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.speed,
      );

  ChannelPropertyDataModel? get directionProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.direction,
      );

  bool get hasSwing => swingProp != null;

  bool get swing {
    final ChannelPropertyDataModel? prop = swingProp;

    final ValueType? value = prop?.value;

    if (value is BooleanValueType) {
      return value.value;
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is BooleanValueType) {
      return defaultValue.value;
    }

    return false;
  }

  bool get hasSpeed => speedProp != null;

  double get speed {
    final ChannelPropertyDataModel? prop = speedProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toDouble();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toDouble();
    }

    return 0;
  }

  double get minSpeed {
    final FormatType? format = speedProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toDouble();
    }

    return 0.0;
  }

  double get maxSpeed {
    final FormatType? format = speedProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toDouble();
    }

    return 100.0;
  }

  bool get hasDirection => directionProp != null;

  FanDirectionValue? get direction {
    final ChannelPropertyDataModel? prop = directionProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && FanDirectionValue.contains(value.value)) {
      return FanDirectionValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        FanDirectionValue.contains(defaultValue.value)) {
      return FanDirectionValue.fromValue(defaultValue.value);
    }

    return null;
  }

  factory FanChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return FanChannelDataModel(
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
