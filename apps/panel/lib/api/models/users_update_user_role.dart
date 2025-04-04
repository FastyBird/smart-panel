// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Updated role of the user.
@JsonEnum()
enum UsersUpdateUserRole {
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

  const UsersUpdateUserRole(this.json);

  factory UsersUpdateUserRole.fromJson(String json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final String? json;
}
