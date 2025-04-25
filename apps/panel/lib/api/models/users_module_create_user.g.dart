// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_module_create_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersModuleCreateUserImpl _$$UsersModuleCreateUserImplFromJson(
        Map<String, dynamic> json) =>
    _$UsersModuleCreateUserImpl(
      id: json['id'] as String,
      username: json['username'] as String,
      password: json['password'] as String,
      role: json['role'] == null
          ? UsersModuleCreateUserRole.user
          : UsersModuleCreateUserRole.fromJson(json['role'] as String),
      email: json['email'] as String?,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
    );

Map<String, dynamic> _$$UsersModuleCreateUserImplToJson(
        _$UsersModuleCreateUserImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'username': instance.username,
      'password': instance.password,
      'role': _$UsersModuleCreateUserRoleEnumMap[instance.role]!,
      'email': instance.email,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
    };

const _$UsersModuleCreateUserRoleEnumMap = {
  UsersModuleCreateUserRole.owner: 'owner',
  UsersModuleCreateUserRole.admin: 'admin',
  UsersModuleCreateUserRole.user: 'user',
  UsersModuleCreateUserRole.display: 'display',
  UsersModuleCreateUserRole.$unknown: r'$unknown',
};
