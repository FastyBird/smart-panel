// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_tiles.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardTilesImpl _$$DashboardResPageCardTilesImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageCardTilesImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method:
          DashboardResPageCardTilesMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => DashboardResPageCardTilesDataUnion.fromJson(
              e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageCardTilesImplToJson(
        _$DashboardResPageCardTilesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageCardTilesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageCardTilesMethodEnumMap = {
  DashboardResPageCardTilesMethod.valueGet: 'GET',
  DashboardResPageCardTilesMethod.post: 'POST',
  DashboardResPageCardTilesMethod.patch: 'PATCH',
  DashboardResPageCardTilesMethod.delete: 'DELETE',
  DashboardResPageCardTilesMethod.$unknown: r'$unknown',
};
