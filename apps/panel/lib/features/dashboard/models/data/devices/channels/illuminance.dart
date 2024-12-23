import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class IlluminanceChannelDataModel extends ChannelDataModel
    with ChannelDensityMixin, ChannelActiveMixin, ChannelFaultMixin {
  IlluminanceChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.illuminance,
        );

  @override
  ChannelPropertyDataModel? get densityProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.density,
      );

  ChannelPropertyDataModel? get levelProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.level,
      );

  @override
  ChannelPropertyDataModel? get activeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get faultProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.fault,
      );

  bool get hasLevel => levelProp != null;

  IlluminanceLevelValue? get level {
    final ChannelPropertyDataModel? prop = levelProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        IlluminanceLevelValue.contains(value.value)) {
      return IlluminanceLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        IlluminanceLevelValue.contains(defaultValue.value)) {
      return IlluminanceLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<IlluminanceLevelValue> get availableLevels {
    final ChannelPropertyDataModel? prop = levelProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => IlluminanceLevelValue.fromValue(item))
          .whereType<IlluminanceLevelValue>()
          .toList();
    }

    return [];
  }

  factory IlluminanceChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return IlluminanceChannelDataModel(
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
