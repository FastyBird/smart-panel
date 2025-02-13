// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_res_users.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersResUsersImpl _$$UsersResUsersImplFromJson(Map<String, dynamic> json) =>
    _$UsersResUsersImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: UsersResUsersMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => UsersUser.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$UsersResUsersImplToJson(_$UsersResUsersImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$UsersResUsersMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$UsersResUsersMethodEnumMap = {
  UsersResUsersMethod.valueGet: 'GET',
  UsersResUsersMethod.post: 'POST',
  UsersResUsersMethod.patch: 'PATCH',
  UsersResUsersMethod.delete: 'DELETE',
  UsersResUsersMethod.$unknown: r'$unknown',
};
