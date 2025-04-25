// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// User role: 'owner' has full access, 'admin' can manage users, 'user' has limited access, 'display' is read-only.
@JsonEnum()
enum UsersModuleUserRole {
  @JsonValue('owner')
  owner('owner'),
  @JsonValue('admin')
  admin('admin'),
  @JsonValue('user')
  user('user'),
  @JsonValue('display')
  display('display'),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const UsersModuleUserRole(this.json);

  factory UsersModuleUserRole.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
