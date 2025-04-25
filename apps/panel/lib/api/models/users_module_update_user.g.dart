// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'users_module_update_user.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$UsersModuleUpdateUserImpl _$$UsersModuleUpdateUserImplFromJson(
        Map<String, dynamic> json) =>
    _$UsersModuleUpdateUserImpl(
      password: json['password'] as String,
      role: UsersModuleUpdateUserRole.fromJson(json['role'] as String),
      email: json['email'] as String?,
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
    );

Map<String, dynamic> _$$UsersModuleUpdateUserImplToJson(
        _$UsersModuleUpdateUserImpl instance) =>
    <String, dynamic>{
      'password': instance.password,
      'role': _$UsersModuleUpdateUserRoleEnumMap[instance.role]!,
      'email': instance.email,
      'first_name': instance.firstName,
      'last_name': instance.lastName,
    };

const _$UsersModuleUpdateUserRoleEnumMap = {
  UsersModuleUpdateUserRole.owner: 'owner',
  UsersModuleUpdateUserRole.admin: 'admin',
  UsersModuleUpdateUserRole.user: 'user',
  UsersModuleUpdateUserRole.display: 'display',
  UsersModuleUpdateUserRole.$unknown: r'$unknown',
};
