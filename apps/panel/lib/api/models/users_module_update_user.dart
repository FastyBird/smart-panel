// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'users_module_update_user_role.dart';

part 'users_module_update_user.freezed.dart';
part 'users_module_update_user.g.dart';

/// Schema for modifying an existing user account.
@Freezed()
class UsersModuleUpdateUser with _$UsersModuleUpdateUser {
  const factory UsersModuleUpdateUser({
    /// New password for the user.
    required String password,

    /// Updated role of the user.
    required UsersModuleUpdateUserRole role,

    /// Updated email address of the user.
    String? email,

    /// Updated first name of the user.
    @JsonKey(name: 'first_name')
    String? firstName,

    /// Updated last name of the user.
    @JsonKey(name: 'last_name')
    String? lastName,
  }) = _UsersModuleUpdateUser;
  
  factory UsersModuleUpdateUser.fromJson(Map<String, Object?> json) => _$UsersModuleUpdateUserFromJson(json);
}
