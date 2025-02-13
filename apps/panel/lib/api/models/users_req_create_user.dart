// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'users_create_user.dart';

part 'users_req_create_user.freezed.dart';
part 'users_req_create_user.g.dart';

/// Request schema for creating new user.
@Freezed()
class UsersReqCreateUser with _$UsersReqCreateUser {
  const factory UsersReqCreateUser({
    required UsersCreateUser data,
  }) = _UsersReqCreateUser;
  
  factory UsersReqCreateUser.fromJson(Map<String, Object?> json) => _$UsersReqCreateUserFromJson(json);
}
