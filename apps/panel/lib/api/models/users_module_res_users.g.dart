// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_module_res_users.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersModuleResUsersImpl _$$UsersModuleResUsersImplFromJson(
        Map<String, dynamic> json) =>
    _$UsersModuleResUsersImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: UsersModuleResUsersMethod.fromJson(json['method'] as String),
      data: (json['data'] as List<dynamic>)
          .map((e) => UsersModuleUser.fromJson(e as Map<String, dynamic>))
          .toList(),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$UsersModuleResUsersImplToJson(
        _$UsersModuleResUsersImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$UsersModuleResUsersMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$UsersModuleResUsersMethodEnumMap = {
  UsersModuleResUsersMethod.valueGet: 'GET',
  UsersModuleResUsersMethod.post: 'POST',
  UsersModuleResUsersMethod.patch: 'PATCH',
  UsersModuleResUsersMethod.delete: 'DELETE',
  UsersModuleResUsersMethod.$unknown: r'$unknown',
};
