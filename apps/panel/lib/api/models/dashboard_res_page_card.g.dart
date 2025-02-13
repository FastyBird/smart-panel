// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardImpl _$$DashboardResPageCardImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageCardImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResPageCardMethod.fromJson(json['method'] as String),
      data: DashboardCard.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageCardImplToJson(
        _$DashboardResPageCardImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageCardMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageCardMethodEnumMap = {
  DashboardResPageCardMethod.valueGet: 'GET',
  DashboardResPageCardMethod.post: 'POST',
  DashboardResPageCardMethod.patch: 'PATCH',
  DashboardResPageCardMethod.delete: 'DELETE',
  DashboardResPageCardMethod.$unknown: r'$unknown',
};
