// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_module_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersModuleUserImpl _$$UsersModuleUserImplFromJson(
        Map<String, dynamic> json) =>
    _$UsersModuleUserImpl(
      id: json['id'] as String,
      username: json['username'] as String,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      email: json['email'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] == null
          ? null
          : DateTime.parse(json['updated_at'] as String),
      isHidden: json['is_hidden'] as bool? ?? false,
      role: json['role'] == null
          ? UsersModuleUserRole.user
          : UsersModuleUserRole.fromJson(json['role'] as String),
    );

Map<String, dynamic> _$$UsersModuleUserImplToJson(
        _$UsersModuleUserImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'username': instance.username,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
      'email': instance.email,
      'created_at': instance.createdAt.toIso8601String(),
      'updated_at': instance.updatedAt?.toIso8601String(),
      'is_hidden': instance.isHidden,
      'role': _$UsersModuleUserRoleEnumMap[instance.role]!,
    };

const _$UsersModuleUserRoleEnumMap = {
  UsersModuleUserRole.owner: 'owner',
  UsersModuleUserRole.admin: 'admin',
  UsersModuleUserRole.user: 'user',
  UsersModuleUserRole.display: 'display',
  UsersModuleUserRole.$unknown: r'$unknown',
};
