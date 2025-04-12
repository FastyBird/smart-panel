// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_data_sources.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResDataSourcesImpl _$$DashboardResDataSourcesImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResDataSourcesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResDataSourcesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardDataSource.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResDataSourcesImplToJson(
        _$DashboardResDataSourcesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResDataSourcesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResDataSourcesMethodEnumMap = {
  DashboardResDataSourcesMethod.valueGet: 'GET',
  DashboardResDataSourcesMethod.post: 'POST',
  DashboardResDataSourcesMethod.patch: 'PATCH',
  DashboardResDataSourcesMethod.delete: 'DELETE',
  DashboardResDataSourcesMethod.$unknown: r'$unknown',
};
