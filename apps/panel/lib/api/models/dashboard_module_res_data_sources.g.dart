// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_module_res_data_sources.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardModuleResDataSourcesImpl
    _$$DashboardModuleResDataSourcesImplFromJson(Map<String, dynamic> json) =>
        _$DashboardModuleResDataSourcesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DashboardModuleResDataSourcesMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) =>
                  DashboardModuleDataSource.fromJson(e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DashboardModuleResDataSourcesImplToJson(
        _$DashboardModuleResDataSourcesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardModuleResDataSourcesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardModuleResDataSourcesMethodEnumMap = {
  DashboardModuleResDataSourcesMethod.valueGet: 'GET',
  DashboardModuleResDataSourcesMethod.post: 'POST',
  DashboardModuleResDataSourcesMethod.patch: 'PATCH',
  DashboardModuleResDataSourcesMethod.delete: 'DELETE',
  DashboardModuleResDataSourcesMethod.$unknown: r'$unknown',
};
