import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';

class MediaPlaybackChannelCapability extends Capability {
  MediaPlaybackChannelCapability({
    required super.channel,
    required super.properties,
  });

  ChannelPropertyModel get statusProp => properties.firstWhere(
        (property) => property.category == PropertyCategory.status,
      );

  ChannelPropertyModel? get trackProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.track,
      );

  ChannelPropertyModel? get durationProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.duration,
      );

  ChannelPropertyModel? get positionProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategory.position,
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
    final ChannelPropertyModel? prop = durationProp;

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
    final ChannelPropertyModel? prop = positionProp;

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
}
