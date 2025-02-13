// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_res_refresh.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthResRefreshImpl _$$AuthResRefreshImplFromJson(Map<String, dynamic> json) =>
    _$AuthResRefreshImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthResRefreshMethod.fromJson(json['method'] as String),
      data: AuthTokenPair.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthResRefreshImplToJson(
        _$AuthResRefreshImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthResRefreshMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthResRefreshMethodEnumMap = {
  AuthResRefreshMethod.valueGet: 'GET',
  AuthResRefreshMethod.post: 'POST',
  AuthResRefreshMethod.patch: 'PATCH',
  AuthResRefreshMethod.delete: 'DELETE',
  AuthResRefreshMethod.$unknown: r'$unknown',
};
