// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'system_module_display_info.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$SystemModuleDisplayInfoImpl _$$SystemModuleDisplayInfoImplFromJson(
        Map<String, dynamic> json) =>
    _$SystemModuleDisplayInfoImpl(
      resolutionX: (json['resolution_x'] as num).toInt(),
      resolutionY: (json['resolution_y'] as num).toInt(),
      currentResX: (json['current_res_x'] as num).toInt(),
      currentResY: (json['current_res_y'] as num).toInt(),
    );

Map<String, dynamic> _$$SystemModuleDisplayInfoImplToJson(
        _$SystemModuleDisplayInfoImpl instance) =>
    <String, dynamic>{
      'resolution_x': instance.resolutionX,
      'resolution_y': instance.resolutionY,
      'current_res_x': instance.currentResX,
      'current_res_y': instance.currentResY,
    };
