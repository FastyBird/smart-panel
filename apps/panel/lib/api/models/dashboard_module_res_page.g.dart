// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_res_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleResPageImpl _$$DashboardModuleResPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardModuleResPageImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardModuleResPageMethod.fromJson(json['method'] as String),
      data: DashboardModulePage.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardModuleResPageImplToJson(
        _$DashboardModuleResPageImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardModuleResPageMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardModuleResPageMethodEnumMap = {
  DashboardModuleResPageMethod.valueGet: 'GET',
  DashboardModuleResPageMethod.post: 'POST',
  DashboardModuleResPageMethod.patch: 'PATCH',
  DashboardModuleResPageMethod.delete: 'DELETE',
  DashboardModuleResPageMethod.$unknown: r'$unknown',
};
