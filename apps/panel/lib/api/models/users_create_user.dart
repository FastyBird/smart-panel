// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'users_create_user_role.dart';

part 'users_create_user.freezed.dart';
part 'users_create_user.g.dart';

/// Schema for creating a new user account.
@Freezed()
class UsersCreateUser with _$UsersCreateUser {
  const factory UsersCreateUser({
    /// Unique identifier for the user.
    required String id,

    /// Unique username for the new user.
    required String username,

    /// Password for the new user. Must be at least 6 characters long.
    required String password,

    /// Role of the user. Defaults to 'user' if not provided.
    @Default(UsersCreateUserRole.user)
    UsersCreateUserRole role,

    /// Optional email address for the user.
    String? email,

    /// Optional first name of the user.
    @JsonKey(name: 'first_name')
    String? firstName,

    /// Optional last name of the user.
    @JsonKey(name: 'last_name')
    String? lastName,
  }) = _UsersCreateUser;
  
  factory UsersCreateUser.fromJson(Map<String, Object?> json) => _$UsersCreateUserFromJson(json);
}
