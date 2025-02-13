// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardTileImpl _$$DashboardResPageCardTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResPageCardTileImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResPageCardTileMethod.fromJson(json['method'] as String),
      data: DashboardResPageCardTileDataUnion.fromJson(
          json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResPageCardTileImplToJson(
        _$DashboardResPageCardTileImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageCardTileMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageCardTileMethodEnumMap = {
  DashboardResPageCardTileMethod.valueGet: 'GET',
  DashboardResPageCardTileMethod.post: 'POST',
  DashboardResPageCardTileMethod.patch: 'PATCH',
  DashboardResPageCardTileMethod.delete: 'DELETE',
  DashboardResPageCardTileMethod.$unknown: r'$unknown',
};
