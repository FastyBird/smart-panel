// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'users_update_user.dart';

part 'users_req_update_user.freezed.dart';
part 'users_req_update_user.g.dart';

/// Request schema for updating an existing user.
@Freezed()
class UsersReqUpdateUser with _$UsersReqUpdateUser {
  const factory UsersReqUpdateUser({
    required UsersUpdateUser data,
  }) = _UsersReqUpdateUser;
  
  factory UsersReqUpdateUser.fromJson(Map<String, Object?> json) => _$UsersReqUpdateUserFromJson(json);
}
