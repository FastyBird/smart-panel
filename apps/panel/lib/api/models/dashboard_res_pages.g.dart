// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_pages.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPagesImpl _$$DashboardResPagesImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPagesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResPagesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) =>
              DashboardResPagesDataUnion.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPagesImplToJson(
        _$DashboardResPagesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPagesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPagesMethodEnumMap = {
  DashboardResPagesMethod.valueGet: 'GET',
  DashboardResPagesMethod.post: 'POST',
  DashboardResPagesMethod.patch: 'PATCH',
  DashboardResPagesMethod.delete: 'DELETE',
  DashboardResPagesMethod.$unknown: r'$unknown',
};
