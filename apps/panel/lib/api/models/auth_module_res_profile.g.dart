// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_module_res_profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthModuleResProfileImpl _$$AuthModuleResProfileImplFromJson(
        Map<String, dynamic> json) =>
    _$AuthModuleResProfileImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthModuleResProfileMethod.fromJson(json['method'] as String),
      data: UsersModuleUser.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthModuleResProfileImplToJson(
        _$AuthModuleResProfileImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthModuleResProfileMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthModuleResProfileMethodEnumMap = {
  AuthModuleResProfileMethod.valueGet: 'GET',
  AuthModuleResProfileMethod.post: 'POST',
  AuthModuleResProfileMethod.patch: 'PATCH',
  AuthModuleResProfileMethod.delete: 'DELETE',
  AuthModuleResProfileMethod.$unknown: r'$unknown',
};
