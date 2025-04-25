// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_display.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleDisplayImpl _$$ConfigModuleDisplayImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleDisplayImpl(
      type: json['type'] == null
          ? ConfigModuleDisplayType.display
          : ConfigModuleDisplayType.fromJson(json['type'] as String),
      darkMode: json['dark_mode'] as bool? ?? false,
      brightness: (json['brightness'] as num?)?.toInt() ?? 0,
      screenLockDuration: (json['screen_lock_duration'] as num?)?.toInt() ?? 30,
      screenSaver: json['screen_saver'] as bool? ?? true,
    );

Map<String, dynamic> _$$ConfigModuleDisplayImplToJson(
        _$ConfigModuleDisplayImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleDisplayTypeEnumMap[instance.type]!,
      'dark_mode': instance.darkMode,
      'brightness': instance.brightness,
      'screen_lock_duration': instance.screenLockDuration,
      'screen_saver': instance.screenSaver,
    };

const _$ConfigModuleDisplayTypeEnumMap = {
  ConfigModuleDisplayType.display: 'display',
  ConfigModuleDisplayType.$unknown: r'$unknown',
};
