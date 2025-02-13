// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_check_username.dart';

part 'auth_req_check_username.freezed.dart';
part 'auth_req_check_username.g.dart';

/// Request schema for username validation.
@Freezed()
class AuthReqCheckUsername with _$AuthReqCheckUsername {
  const factory AuthReqCheckUsername({
    required AuthCheckUsername data,
  }) = _AuthReqCheckUsername;
  
  factory AuthReqCheckUsername.fromJson(Map<String, Object?> json) => _$AuthReqCheckUsernameFromJson(json);
}
