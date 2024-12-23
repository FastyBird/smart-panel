import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channel.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class MediaPlaybackChannelDataModel extends ChannelDataModel {
  MediaPlaybackChannelDataModel({
    required super.id,
    super.name,
    super.description,
    required super.device,
    required super.properties,
    required super.controls,
    super.createdAt,
    super.updatedAt,
  }) : super(
          category: ChannelCategoryType.mediaPlayback,
        );

  ChannelPropertyDataModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.status,
      );

  ChannelPropertyDataModel? get trackProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.track,
      );

  ChannelPropertyDataModel? get durationProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.duration,
      );

  ChannelPropertyDataModel? get positionProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.position,
      );

  MediaPlaybackStatusValue get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType &&
        MediaPlaybackStatusValue.contains(value.value)) {
      MediaPlaybackStatusValue? status =
          MediaPlaybackStatusValue.fromValue(value.value);

      if (status != null) {
        return status;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${statusProp.category.value}',
    );
  }

  bool get isPlaying => status == MediaPlaybackStatusValue.playing;

  bool get isPaused => status == MediaPlaybackStatusValue.paused;

  bool get isStopped => status == MediaPlaybackStatusValue.stopped;

  bool get hasTrack => trackProp != null;

  String? get track {
    final ValueType? value = trackProp?.value;

    if (value is StringValueType) {
      return value.value;
    }

    return null;
  }

  bool get hasDuration => durationProp != null;

  int get duration {
    final ChannelPropertyDataModel? prop = durationProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minDuration {
    final FormatType? format = durationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxDuration {
    final FormatType? format = durationProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 86400;
  }

  bool get hasPosition => positionProp != null;

  int get position {
    final ChannelPropertyDataModel? prop = positionProp;

    final ValueType? value = prop?.value;

    if (value is NumberValueType) {
      return value.value.toInt();
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is NumberValueType) {
      return defaultValue.value.toInt();
    }

    return 0;
  }

  int get minPosition {
    final FormatType? format = positionProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[0] as num).toInt();
    }

    return 0;
  }

  int get maxPosition {
    final FormatType? format = positionProp?.format;

    if (format is NumberListFormatType && format.value.length == 2) {
      return (format.value[1] as num).toInt();
    }

    return 86400;
  }

  factory MediaPlaybackChannelDataModel.fromJson(
    Map<String, dynamic> json,
    List<ChannelPropertyDataModel> properties,
    List<ChannelControlDataModel> controls,
  ) {
    return MediaPlaybackChannelDataModel(
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
