// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResDataSourceImpl _$$DashboardResDataSourceImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResDataSourceImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResDataSourceMethod.fromJson(json['method'] as String),
      data: DashboardDataSource.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResDataSourceImplToJson(
        _$DashboardResDataSourceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResDataSourceMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResDataSourceMethodEnumMap = {
  DashboardResDataSourceMethod.valueGet: 'GET',
  DashboardResDataSourceMethod.post: 'POST',
  DashboardResDataSourceMethod.patch: 'PATCH',
  DashboardResDataSourceMethod.delete: 'DELETE',
  DashboardResDataSourceMethod.$unknown: r'$unknown',
};
