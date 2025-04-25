// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_module_login.dart';

part 'auth_module_req_login.freezed.dart';
part 'auth_module_req_login.g.dart';

/// Request schema for user authentication.
@Freezed()
class AuthModuleReqLogin with _$AuthModuleReqLogin {
  const factory AuthModuleReqLogin({
    required AuthModuleLogin data,
  }) = _AuthModuleReqLogin;
  
  factory AuthModuleReqLogin.fromJson(Map<String, Object?> json) => _$AuthModuleReqLoginFromJson(json);
}
