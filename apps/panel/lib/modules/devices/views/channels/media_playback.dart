import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/album.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/artist.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/command.dart';
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

  CommandChannelPropertyView? get commandProp =>
      properties.whereType<CommandChannelPropertyView>().firstOrNull;

  ArtistChannelPropertyView? get artistProp =>
      properties.whereType<ArtistChannelPropertyView>().firstOrNull;

  AlbumChannelPropertyView? get albumProp =>
      properties.whereType<AlbumChannelPropertyView>().firstOrNull;

  bool get hasCommand => commandProp != null;

  bool get hasArtist => artistProp != null;

  String? get artist => artistProp?.artist;

  bool get hasAlbum => albumProp != null;

  String? get album => albumProp?.album;

  List<MediaPlaybackCommandValue> get availableCommands {
    final CommandChannelPropertyView? prop = commandProp;
    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => MediaPlaybackCommandValue.fromValue(item))
          .whereType<MediaPlaybackCommandValue>()
          .toList();
    }

    return [];
  }

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
