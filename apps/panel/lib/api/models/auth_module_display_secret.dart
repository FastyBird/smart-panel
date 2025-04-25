// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_module_display_secret.freezed.dart';
part 'auth_module_display_secret.g.dart';

/// Schema for display registration result.
@Freezed()
class AuthModuleDisplaySecret with _$AuthModuleDisplaySecret {
  const factory AuthModuleDisplaySecret({
    /// Display account secret
    required String secret,
  }) = _AuthModuleDisplaySecret;
  
  factory AuthModuleDisplaySecret.fromJson(Map<String, Object?> json) => _$AuthModuleDisplaySecretFromJson(json);
}
