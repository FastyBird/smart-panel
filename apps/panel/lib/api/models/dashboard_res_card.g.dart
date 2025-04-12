// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResCardImpl _$$DashboardResCardImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResCardImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResCardMethod.fromJson(json['method'] as String),
      data: DashboardCard.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResCardImplToJson(
        _$DashboardResCardImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResCardMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResCardMethodEnumMap = {
  DashboardResCardMethod.valueGet: 'GET',
  DashboardResCardMethod.post: 'POST',
  DashboardResCardMethod.patch: 'PATCH',
  DashboardResCardMethod.delete: 'DELETE',
  DashboardResCardMethod.$unknown: r'$unknown',
};
