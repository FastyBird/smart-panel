// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_display_secret.freezed.dart';
part 'auth_display_secret.g.dart';

/// Schema for display registration result.
@Freezed()
class AuthDisplaySecret with _$AuthDisplaySecret {
  const factory AuthDisplaySecret({
    /// Display account secret
    required String secret,
  }) = _AuthDisplaySecret;
  
  factory AuthDisplaySecret.fromJson(Map<String, Object?> json) => _$AuthDisplaySecretFromJson(json);
}
