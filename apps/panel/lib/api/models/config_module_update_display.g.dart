// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'config_module_update_display.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$ConfigModuleUpdateDisplayImpl _$$ConfigModuleUpdateDisplayImplFromJson(
        Map<String, dynamic> json) =>
    _$ConfigModuleUpdateDisplayImpl(
      type: ConfigModuleUpdateDisplayType.fromJson(json['type'] as String),
      darkMode: json['dark_mode'] as bool,
      brightness: (json['brightness'] as num).toInt(),
      screenLockDuration: (json['screen_lock_duration'] as num).toInt(),
      screenSaver: json['screen_saver'] as bool,
    );

Map<String, dynamic> _$$ConfigModuleUpdateDisplayImplToJson(
        _$ConfigModuleUpdateDisplayImpl instance) =>
    <String, dynamic>{
      'type': _$ConfigModuleUpdateDisplayTypeEnumMap[instance.type]!,
      'dark_mode': instance.darkMode,
      'brightness': instance.brightness,
      'screen_lock_duration': instance.screenLockDuration,
      'screen_saver': instance.screenSaver,
    };

const _$ConfigModuleUpdateDisplayTypeEnumMap = {
  ConfigModuleUpdateDisplayType.display: 'display',
  ConfigModuleUpdateDisplayType.$unknown: r'$unknown',
};
