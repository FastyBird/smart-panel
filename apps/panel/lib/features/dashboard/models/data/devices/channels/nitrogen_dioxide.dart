import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class NitrogenDioxideChannelDataModel extends ChannelDataModel
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  NitrogenDioxideChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.nitrogenDioxide,
        );

  @override
  ChannelPropertyDataModel? get detectedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.detected,
      );

  @override
  ChannelPropertyDataModel? get densityProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.density,
      );

  ChannelPropertyDataModel? get modeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.mode,
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

  bool get hasMode => modeProp != null;

  NitrogenDioxideModeValues get mode {
    final ChannelPropertyDataModel? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        NitrogenDioxideModeValues.contains(value.value)) {
      NitrogenDioxideModeValues? converted =
          NitrogenDioxideModeValues.fromValue(value.value);

      if (converted != null) {
        return converted;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        NitrogenDioxideModeValues.contains(defaultValue.value)) {
      NitrogenDioxideModeValues? converted =
          NitrogenDioxideModeValues.fromValue(defaultValue.value);

      if (converted != null) {
        return converted;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${modeProp?.category.value}',
    );
  }

  List<NitrogenDioxideModeValues> get availableModes {
    final ChannelPropertyDataModel? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => NitrogenDioxideModeValues.fromValue(item))
          .whereType<NitrogenDioxideModeValues>()
          .toList();
    }

    return [];
  }

  factory NitrogenDioxideChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return NitrogenDioxideChannelDataModel(
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
