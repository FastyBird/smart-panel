// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_module_res_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersModuleResUserImpl _$$UsersModuleResUserImplFromJson(
        Map<String, dynamic> json) =>
    _$UsersModuleResUserImpl(
      status: json['status'] as String,
      timestamp: DateTime.parse(json['timestamp'] as String),
      requestId: json['request_id'] as String,
      path: json['path'] as String,
      method: UsersModuleResUserMethod.fromJson(json['method'] as String),
      data: UsersModuleUser.fromJson(json['data'] as Map<String, dynamic>),
      metadata:
          CommonResMetadata.fromJson(json['metadata'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$$UsersModuleResUserImplToJson(
        _$UsersModuleResUserImpl instance) =>
    <String, dynamic>{
      'status': instance.status,
      'timestamp': instance.timestamp.toIso8601String(),
      'request_id': instance.requestId,
      'path': instance.path,
      'method': _$UsersModuleResUserMethodEnumMap[instance.method]!,
      'data': instance.data,
      'metadata': instance.metadata,
    };

const _$UsersModuleResUserMethodEnumMap = {
  UsersModuleResUserMethod.valueGet: 'GET',
  UsersModuleResUserMethod.post: 'POST',
  UsersModuleResUserMethod.patch: 'PATCH',
  UsersModuleResUserMethod.delete: 'DELETE',
  UsersModuleResUserMethod.$unknown: r'$unknown',
};
