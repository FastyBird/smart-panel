// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_module_res_refresh.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthModuleResRefreshImpl _$$AuthModuleResRefreshImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthModuleResRefreshImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthModuleResRefreshMethod.fromJson(json['method'] as String),
      data: AuthModuleTokenPair.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthModuleResRefreshImplToJson(
        _$AuthModuleResRefreshImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthModuleResRefreshMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthModuleResRefreshMethodEnumMap = {
  AuthModuleResRefreshMethod.valueGet: 'GET',
  AuthModuleResRefreshMethod.post: 'POST',
  AuthModuleResRefreshMethod.patch: 'PATCH',
  AuthModuleResRefreshMethod.delete: 'DELETE',
  AuthModuleResRefreshMethod.$unknown: r'$unknown',
};
