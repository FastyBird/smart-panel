// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_module_check_username.freezed.dart';
part 'auth_module_check_username.g.dart';

/// Schema for checking username availability.
@Freezed()
class AuthModuleCheckUsername with _$AuthModuleCheckUsername {
  const factory AuthModuleCheckUsername({
    /// The username to check for availability.
    required String username,
  }) = _AuthModuleCheckUsername;
  
  factory AuthModuleCheckUsername.fromJson(Map<String, Object?> json) => _$AuthModuleCheckUsernameFromJson(json);
}
