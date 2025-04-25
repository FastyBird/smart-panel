// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

import 'auth_module_check_username.dart';

part 'auth_module_req_check_username.freezed.dart';
part 'auth_module_req_check_username.g.dart';

/// Request schema for username validation.
@Freezed()
class AuthModuleReqCheckUsername with _$AuthModuleReqCheckUsername {
  const factory AuthModuleReqCheckUsername({
    required AuthModuleCheckUsername data,
  }) = _AuthModuleReqCheckUsername;
  
  factory AuthModuleReqCheckUsername.fromJson(Map<String, Object?> json) => _$AuthModuleReqCheckUsernameFromJson(json);
}
