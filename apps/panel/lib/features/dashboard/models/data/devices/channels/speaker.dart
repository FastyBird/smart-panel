import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class SpeakerChannelDataModel extends ChannelDataModel
    with ChannelActiveMixin, ChannelVolumeMixin {
  SpeakerChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.speaker,
        );

  @override
  ChannelPropertyDataModel get activeProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.active,
      );

  @override
  ChannelPropertyDataModel? get volumeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.volume,
      );

  ChannelPropertyDataModel? get modeProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.mode,
      );

  bool get hasMode => modeProp != null;

  SpeakerModeValue get mode {
    final ChannelPropertyDataModel? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType && SpeakerModeValue.contains(value.value)) {
      SpeakerModeValue? type = SpeakerModeValue.fromValue(value.value);

      if (type != null) {
        return type;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${modeProp?.category.value}',
    );
  }

  List<SpeakerModeValue> get availableModes {
    final ChannelPropertyDataModel? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => SpeakerModeValue.fromValue(item))
          .whereType<SpeakerModeValue>()
          .toList();
    }

    return [];
  }

  factory SpeakerChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return SpeakerChannelDataModel(
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
