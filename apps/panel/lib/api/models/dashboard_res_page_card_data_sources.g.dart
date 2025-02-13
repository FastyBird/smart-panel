// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'dashboard_res_page_card_data_sources.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$DashboardResPageCardDataSourcesImpl
    _$$DashboardResPageCardDataSourcesImplFromJson(Map<String, dynamic> json) =>
        _$DashboardResPageCardDataSourcesImpl(
          status: json['status'] as String,
          timestamp: DateTime.parse(json['timestamp'] as String),
          requestId: json['request_id'] as String,
          path: json['path'] as String,
          method: DashboardResPageCardDataSourcesMethod.fromJson(
              json['method'] as String),
          data: (json['data'] as List<dynamic>)
              .map((e) => DashboardResPageCardDataSourcesDataUnion.fromJson(
                  e as Map<String, dynamic>))
              .toList(),
          metadata: CommonResMetadata.fromJson(
              json['metadata'] as Map<String, dynamic>),
        );

Map<String, dynamic> _$$DashboardResPageCardDataSourcesImplToJson(
        _$DashboardResPageCardDataSourcesImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method':
          _$DashboardResPageCardDataSourcesMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$DashboardResPageCardDataSourcesMethodEnumMap = {
  DashboardResPageCardDataSourcesMethod.valueGet: 'GET',
  DashboardResPageCardDataSourcesMethod.post: 'POST',
  DashboardResPageCardDataSourcesMethod.patch: 'PATCH',
  DashboardResPageCardDataSourcesMethod.delete: 'DELETE',
  DashboardResPageCardDataSourcesMethod.$unknown: r'$unknown',
};
