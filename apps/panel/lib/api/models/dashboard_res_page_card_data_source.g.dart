// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_data_source.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardDataSourceImpl
    _$$DashboardResPageCardDataSourceImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageCardDataSourceImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DashboardResPageCardDataSourceMethod.fromJson(
              json['method'] as String),
          data: DashboardResPageCardDataSourceDataUnion.fromJson(
              json['data'] as Map<String, dynamic>),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DashboardResPageCardDataSourceImplToJson(
        _$DashboardResPageCardDataSourceImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$DashboardResPageCardDataSourceMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageCardDataSourceMethodEnumMap = {
  DashboardResPageCardDataSourceMethod.valueGet: 'GET',
  DashboardResPageCardDataSourceMethod.post: 'POST',
  DashboardResPageCardDataSourceMethod.patch: 'PATCH',
  DashboardResPageCardDataSourceMethod.delete: 'DELETE',
  DashboardResPageCardDataSourceMethod.$unknown: r'$unknown',
};
