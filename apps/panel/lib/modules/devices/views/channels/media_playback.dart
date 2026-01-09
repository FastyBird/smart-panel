import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/modules/devices/types/payloads.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/duration.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/position.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/track.dart';

class MediaPlaybackChannelView extends ChannelView {
  MediaPlaybackChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  TrackChannelPropertyView? get trackProp =>
      properties.whereType<TrackChannelPropertyView>().firstOrNull;

  DurationChannelPropertyView? get durationProp =>
      properties.whereType<DurationChannelPropertyView>().firstOrNull;

  PositionChannelPropertyView? get positionProp =>
      properties.whereType<PositionChannelPropertyView>().firstOrNull;

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
      'Channel is missing required value for property: ${statusProp.category.json}',
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
    final DurationChannelPropertyView? prop = durationProp;

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
    final PositionChannelPropertyView? prop = positionProp;

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
