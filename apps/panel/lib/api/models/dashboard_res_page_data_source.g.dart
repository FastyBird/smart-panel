// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageDataSourceImpl _$$DashboardResPageDataSourceImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageDataSourceImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          DashboardResPageDataSourceMethod.fromJson(json['method'] as String),
      data: DashboardResPageDataSourceDataUnion.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageDataSourceImplToJson(
        _$DashboardResPageDataSourceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageDataSourceMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageDataSourceMethodEnumMap = {
  DashboardResPageDataSourceMethod.valueGet: 'GET',
  DashboardResPageDataSourceMethod.post: 'POST',
  DashboardResPageDataSourceMethod.patch: 'PATCH',
  DashboardResPageDataSourceMethod.delete: 'DELETE',
  DashboardResPageDataSourceMethod.$unknown: r'$unknown',
};
