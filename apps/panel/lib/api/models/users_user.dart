// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'users_user_role.dart';

part 'users_user.freezed.dart';
part 'users_user.g.dart';

/// Schema for a registered user within the system.
@Freezed()
class UsersUser with _$UsersUser {
  const factory UsersUser({
    /// Unique identifier for the user.
    required String id,

    /// Unique username of the user.
    required String username,

    /// First name of the user.
    @JsonKey(name: 'first_name')
    required String? firstName,

    /// Last name of the user.
    @JsonKey(name: 'last_name')
    required String? lastName,

    /// Email address of the user.
    required String? email,

    /// The timestamp when the user was created.
    @JsonKey(name: 'created_at')
    required DateTime createdAt,

    /// The timestamp when the user was updated.
    @JsonKey(name: 'updated_at')
    required DateTime? updatedAt,

    /// Indicates whether the user is hidden from general visibility.
    @JsonKey(name: 'is_hidden')
    @Default(false)
    bool isHidden,

    /// User role: 'owner' has full access, 'admin' can manage users, 'user' has limited access, 'display' is read-only.
    @Default(UsersUserRole.user)
    UsersUserRole role,
  }) = _UsersUser;
  
  factory UsersUser.fromJson(Map<String, Object?> json) => _$UsersUserFromJson(json);
}
