// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_tile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResTileImpl _$$DashboardResTileImplFromJson(
        Map<String, dynamic> json) =>
    _$DashboardResTileImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: DashboardResTileMethod.fromJson(json['method'] as String),
      data: DashboardTile.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$DashboardResTileImplToJson(
        _$DashboardResTileImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResTileMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResTileMethodEnumMap = {
  DashboardResTileMethod.valueGet: 'GET',
  DashboardResTileMethod.post: 'POST',
  DashboardResTileMethod.patch: 'PATCH',
  DashboardResTileMethod.delete: 'DELETE',
  DashboardResTileMethod.$unknown: r'$unknown',
};
