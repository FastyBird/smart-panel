// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'users_module_update_user.dart';

part 'users_module_req_update_user.freezed.dart';
part 'users_module_req_update_user.g.dart';

/// Request schema for updating an existing user.
@Freezed()
class UsersModuleReqUpdateUser with _$UsersModuleReqUpdateUser {
  const factory UsersModuleReqUpdateUser({
    required UsersModuleUpdateUser data,
  }) = _UsersModuleReqUpdateUser;
  
  factory UsersModuleReqUpdateUser.fromJson(Map<String, Object?> json) => _$UsersModuleReqUpdateUserFromJson(json);
}
