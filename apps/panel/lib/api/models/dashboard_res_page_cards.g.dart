// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_cards.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardsImpl _$$DashboardResPageCardsImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageCardsImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResPageCardsMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardCard.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageCardsImplToJson(
        _$DashboardResPageCardsImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageCardsMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageCardsMethodEnumMap = {
  DashboardResPageCardsMethod.valueGet: 'GET',
  DashboardResPageCardsMethod.post: 'POST',
  DashboardResPageCardsMethod.patch: 'PATCH',
  DashboardResPageCardsMethod.delete: 'DELETE',
  DashboardResPageCardsMethod.$unknown: r'$unknown',
};
