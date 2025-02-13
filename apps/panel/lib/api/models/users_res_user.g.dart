// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_res_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersResUserImpl _$$UsersResUserImplFromJson(Map<String, dynamic> json) =>
    _$UsersResUserImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: UsersResUserMethod.fromJson(json['method'] as String),
      data: UsersUser.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$UsersResUserImplToJson(_$UsersResUserImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$UsersResUserMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$UsersResUserMethodEnumMap = {
  UsersResUserMethod.valueGet: 'GET',
  UsersResUserMethod.post: 'POST',
  UsersResUserMethod.patch: 'PATCH',
  UsersResUserMethod.delete: 'DELETE',
  UsersResUserMethod.$unknown: r'$unknown',
};
