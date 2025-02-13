// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_update_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersUpdateUserImpl _$$UsersUpdateUserImplFromJson(
        Map<String, dynamic> json) =>
    _$UsersUpdateUserImpl(
      password: json['password'] as String,
      role: UsersUpdateUserRole.fromJson(json['role'] as String),
      email: json['email'] as String?,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
    );

Map<String, dynamic> _$$UsersUpdateUserImplToJson(
        _$UsersUpdateUserImpl instance) =>
    <String, dynamic>{
      'password': instance.password,
      'role': _$UsersUpdateUserRoleEnumMap[instance.role]!,
      'email': instance.email,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
    };

const _$UsersUpdateUserRoleEnumMap = {
  UsersUpdateUserRole.owner: 'owner',
  UsersUpdateUserRole.admin: 'admin',
  UsersUpdateUserRole.user: 'user',
  UsersUpdateUserRole.display: 'display',
  UsersUpdateUserRole.$unknown: r'$unknown',
};
