// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'common_res_metadata.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$CommonResMetadataImpl _$$CommonResMetadataImplFromJson(
        Map<String, dynamic> json) =>
    _$CommonResMetadataImpl(
      requestDurationMs: (json['request_duration_ms'] as num).toDouble(),
      serverTime: DateTime.parse(json['server_time'] as String),
      cpuUsage: (json['cpu_usage'] as num).toDouble(),
    );

Map<String, dynamic> _$$CommonResMetadataImplToJson(
        _$CommonResMetadataImpl instance) =>
    <String, dynamic>{
      'request_duration_ms': instance.requestDurationMs,
      'server_time': instance.serverTime.toIso8601String(),
      'cpu_usage': instance.cpuUsage,
    };
