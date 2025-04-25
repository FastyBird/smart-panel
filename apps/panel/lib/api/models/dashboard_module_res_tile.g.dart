// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_res_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleResTileImpl _$$DashboardModuleResTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardModuleResTileImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardModuleResTileMethod.fromJson(json['method'] as String),
      data: DashboardModuleTile.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardModuleResTileImplToJson(
        _$DashboardModuleResTileImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardModuleResTileMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardModuleResTileMethodEnumMap = {
  DashboardModuleResTileMethod.valueGet: 'GET',
  DashboardModuleResTileMethod.post: 'POST',
  DashboardModuleResTileMethod.patch: 'PATCH',
  DashboardModuleResTileMethod.delete: 'DELETE',
  DashboardModuleResTileMethod.$unknown: r'$unknown',
};
