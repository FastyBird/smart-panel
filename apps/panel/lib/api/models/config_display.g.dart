// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_display.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigDisplayImpl _$$ConfigDisplayImplFromJson(Map<String, dynamic> json) =>
    _$ConfigDisplayImpl(
      type: json['type'] == null
          ? ConfigDisplayType.display
          : ConfigDisplayType.fromJson(json['type'] as String),
      darkMode: json['dark_mode'] as bool? ?? false,
      brightness: (json['brightness'] as num?)?.toInt() ?? 0,
      screenLockDuration: (json['screen_lock_duration'] as num?)?.toInt() ?? 30,
      screenSaver: json['screen_saver'] as bool? ?? true,
    );

Map<String, dynamic> _$$ConfigDisplayImplToJson(_$ConfigDisplayImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigDisplayTypeEnumMap[instance.type]!,
      'dark_mode': instance.darkMode,
      'brightness': instance.brightness,
      'screen_lock_duration': instance.screenLockDuration,
      'screen_saver': instance.screenSaver,
    };

const _$ConfigDisplayTypeEnumMap = {
  ConfigDisplayType.display: 'display',
  ConfigDisplayType.$unknown: r'$unknown',
};
