// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_create_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersCreateUserImpl _$$UsersCreateUserImplFromJson(
        Map<String, dynamic> json) =>
    _$UsersCreateUserImpl(
      id: json['id'] as String,
      username: json['username'] as String,
      password: json['password'] as String,
      role: json['role'] == null
          ? UsersCreateUserRole.user
          : UsersCreateUserRole.fromJson(json['role'] as String),
      email: json['email'] as String?,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
    );

Map<String, dynamic> _$$UsersCreateUserImplToJson(
        _$UsersCreateUserImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'username': instance.username,
      'password': instance.password,
      'role': _$UsersCreateUserRoleEnumMap[instance.role]!,
      'email': instance.email,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
    };

const _$UsersCreateUserRoleEnumMap = {
  UsersCreateUserRole.owner: 'owner',
  UsersCreateUserRole.admin: 'admin',
  UsersCreateUserRole.user: 'user',
  UsersCreateUserRole.display: 'display',
  UsersCreateUserRole.$unknown: r'$unknown',
};
