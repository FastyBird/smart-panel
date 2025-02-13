// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_data_sources.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageDataSourcesImpl _$$DashboardResPageDataSourcesImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageDataSourcesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          DashboardResPageDataSourcesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardResPageDataSourcesDataUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageDataSourcesImplToJson(
        _$DashboardResPageDataSourcesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageDataSourcesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageDataSourcesMethodEnumMap = {
  DashboardResPageDataSourcesMethod.valueGet: 'GET',
  DashboardResPageDataSourcesMethod.post: 'POST',
  DashboardResPageDataSourcesMethod.patch: 'PATCH',
  DashboardResPageDataSourcesMethod.delete: 'DELETE',
  DashboardResPageDataSourcesMethod.$unknown: r'$unknown',
};
