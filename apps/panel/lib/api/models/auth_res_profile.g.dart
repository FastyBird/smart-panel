// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_res_profile.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$AuthResProfileImpl _$$AuthResProfileImplFromJson(Map<String, dynamic> json) =>
    _$AuthResProfileImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: AuthResProfileMethod.fromJson(json['method'] as String),
      data: UsersUser.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$AuthResProfileImplToJson(
        _$AuthResProfileImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$AuthResProfileMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$AuthResProfileMethodEnumMap = {
  AuthResProfileMethod.valueGet: 'GET',
  AuthResProfileMethod.post: 'POST',
  AuthResProfileMethod.patch: 'PATCH',
  AuthResProfileMethod.delete: 'DELETE',
  AuthResProfileMethod.$unknown: r'$unknown',
};
