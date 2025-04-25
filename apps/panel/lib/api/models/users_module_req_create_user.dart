// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'users_module_create_user.dart';

part 'users_module_req_create_user.freezed.dart';
part 'users_module_req_create_user.g.dart';

/// Request schema for creating new user.
@Freezed()
class UsersModuleReqCreateUser with _$UsersModuleReqCreateUser {
  const factory UsersModuleReqCreateUser({
    required UsersModuleCreateUser data,
  }) = _UsersModuleReqCreateUser;
  
  factory UsersModuleReqCreateUser.fromJson(Map<String, Object?> json) => _$UsersModuleReqCreateUserFromJson(json);
}
