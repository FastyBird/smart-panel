// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageImpl _$$DashboardResPageImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResPageMethod.fromJson(json['method'] as String),
      data: DashboardResPageDataUnion.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageImplToJson(
        _$DashboardResPageImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageMethodEnumMap = {
  DashboardResPageMethod.valueGet: 'GET',
  DashboardResPageMethod.post: 'POST',
  DashboardResPageMethod.patch: 'PATCH',
  DashboardResPageMethod.delete: 'DELETE',
  DashboardResPageMethod.$unknown: r'$unknown',
};
