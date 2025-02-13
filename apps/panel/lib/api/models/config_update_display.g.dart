// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_update_display.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigUpdateDisplayImpl _$$ConfigUpdateDisplayImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigUpdateDisplayImpl(
      type: ConfigUpdateDisplayType.fromJson(json['type'] as String),
      darkMode: json['dark_mode'] as bool,
      brightness: (json['brightness'] as num).toInt(),
      screenLockDuration: (json['screen_lock_duration'] as num).toInt(),
      screenSaver: json['screen_saver'] as bool,
    );

Map<String, dynamic> _$$ConfigUpdateDisplayImplToJson(
        _$ConfigUpdateDisplayImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigUpdateDisplayTypeEnumMap[instance.type]!,
      'dark_mode': instance.darkMode,
      'brightness': instance.brightness,
      'screen_lock_duration': instance.screenLockDuration,
      'screen_saver': instance.screenSaver,
    };

const _$ConfigUpdateDisplayTypeEnumMap = {
  ConfigUpdateDisplayType.display: 'display',
  ConfigUpdateDisplayType.$unknown: r'$unknown',
};
