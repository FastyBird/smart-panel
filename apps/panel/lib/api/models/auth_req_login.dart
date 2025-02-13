// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_login.dart';

part 'auth_req_login.freezed.dart';
part 'auth_req_login.g.dart';

/// Request schema for user authentication.
@Freezed()
class AuthReqLogin with _$AuthReqLogin {
  const factory AuthReqLogin({
    required AuthLogin data,
  }) = _AuthReqLogin;
  
  factory AuthReqLogin.fromJson(Map<String, Object?> json) => _$AuthReqLoginFromJson(json);
}
