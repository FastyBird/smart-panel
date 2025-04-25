// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_res_tiles.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleResTilesImpl _$$DashboardModuleResTilesImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardModuleResTilesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardModuleResTilesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardModuleTile.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardModuleResTilesImplToJson(
        _$DashboardModuleResTilesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardModuleResTilesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardModuleResTilesMethodEnumMap = {
  DashboardModuleResTilesMethod.valueGet: 'GET',
  DashboardModuleResTilesMethod.post: 'POST',
  DashboardModuleResTilesMethod.patch: 'PATCH',
  DashboardModuleResTilesMethod.delete: 'DELETE',
  DashboardModuleResTilesMethod.$unknown: r'$unknown',
};
