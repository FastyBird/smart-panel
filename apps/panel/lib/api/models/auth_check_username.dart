// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'auth_check_username.freezed.dart';
part 'auth_check_username.g.dart';

/// Schema for checking username availability.
@Freezed()
class AuthCheckUsername with _$AuthCheckUsername {
  const factory AuthCheckUsername({
    /// The username to check for availability.
    required String username,
  }) = _AuthCheckUsername;
  
  factory AuthCheckUsername.fromJson(Map<String, Object?> json) => _$AuthCheckUsernameFromJson(json);
}
