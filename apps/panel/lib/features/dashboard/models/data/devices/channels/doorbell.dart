import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class DoorbellChannelDataModel extends ChannelDataModel
    with ChannelBrightnessMixin, ChannelTamperedMixin {
  DoorbellChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.doorbell,
        );

  ChannelPropertyDataModel get eventPropProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.event,
      );

  @override
  ChannelPropertyDataModel? get brightnessProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.brightness,
      );

  @override
  ChannelPropertyDataModel? get tamperedProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.tampered,
      );

  ButtonEventValue? get event {
    final ValueType? value = eventPropProp.value;

    if (value is StringValueType && ButtonEventValue.contains(value.value)) {
      return ButtonEventValue.fromValue(value.value);
    }

    return null;
  }

  List<ButtonEventValue> get availableEvents {
    final FormatType? format = eventPropProp.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => ButtonEventValue.fromValue(item))
          .whereType<ButtonEventValue>()
          .toList();
    }

    return [];
  }

  factory DoorbellChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return DoorbellChannelDataModel(
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
