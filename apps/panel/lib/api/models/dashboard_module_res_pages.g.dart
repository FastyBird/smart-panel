// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_res_pages.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleResPagesImpl _$$DashboardModuleResPagesImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardModuleResPagesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardModuleResPagesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardModulePage.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardModuleResPagesImplToJson(
        _$DashboardModuleResPagesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardModuleResPagesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardModuleResPagesMethodEnumMap = {
  DashboardModuleResPagesMethod.valueGet: 'GET',
  DashboardModuleResPagesMethod.post: 'POST',
  DashboardModuleResPagesMethod.patch: 'PATCH',
  DashboardModuleResPagesMethod.delete: 'DELETE',
  DashboardModuleResPagesMethod.$unknown: r'$unknown',
};
