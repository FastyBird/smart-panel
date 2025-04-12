// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_cards.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResCardsImpl _$$DashboardResCardsImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResCardsImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResCardsMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardCard.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResCardsImplToJson(
        _$DashboardResCardsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResCardsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResCardsMethodEnumMap = {
  DashboardResCardsMethod.valueGet: 'GET',
  DashboardResCardsMethod.post: 'POST',
  DashboardResCardsMethod.patch: 'PATCH',
  DashboardResCardsMethod.delete: 'DELETE',
  DashboardResCardsMethod.$unknown: r'$unknown',
};
