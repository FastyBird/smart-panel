// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'temperature.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$TemperatureImpl _$$TemperatureImplFromJson(Map<String, dynamic> json) =>
    _$TemperatureImpl(
      morn: json['morn'] as num?,
      day: json['day'] as num?,
      eve: json['eve'] as num?,
      night: json['night'] as num?,
      min: json['min'] as num?,
      max: json['max'] as num?,
    );

Map<String, dynamic> _$$TemperatureImplToJson(_$TemperatureImpl instance) =>
    <String, dynamic>{
      'morn': instance.morn,
      'day': instance.day,
      'eve': instance.eve,
      'night': instance.night,
      'min': instance.min,
      'max': instance.max,
    };
