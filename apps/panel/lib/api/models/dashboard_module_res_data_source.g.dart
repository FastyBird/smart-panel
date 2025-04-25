// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_res_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleResDataSourceImpl _$$DashboardModuleResDataSourceImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardModuleResDataSourceImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          DashboardModuleResDataSourceMethod.fromJson(json['method'] as String),
      data: DashboardModuleDataSource.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardModuleResDataSourceImplToJson(
        _$DashboardModuleResDataSourceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardModuleResDataSourceMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardModuleResDataSourceMethodEnumMap = {
  DashboardModuleResDataSourceMethod.valueGet: 'GET',
  DashboardModuleResDataSourceMethod.post: 'POST',
  DashboardModuleResDataSourceMethod.patch: 'PATCH',
  DashboardModuleResDataSourceMethod.delete: 'DELETE',
  DashboardModuleResDataSourceMethod.$unknown: r'$unknown',
};
