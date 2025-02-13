// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

/// Error codes returned by third-party devices when processing requests.
@JsonEnum()
enum DevicesThirdPartyErrorCode {
  @JsonValue(0)
  value0(0),
  @JsonValue(-80001)
  valueMinus80001(-80001),
  @JsonValue(-80002)
  valueMinus80002(-80002),
  @JsonValue(-80003)
  valueMinus80003(-80003),
  @JsonValue(-80004)
  valueMinus80004(-80004),
  @JsonValue(-80005)
  valueMinus80005(-80005),
  @JsonValue(-80006)
  valueMinus80006(-80006),
  @JsonValue(-80007)
  valueMinus80007(-80007),
  @JsonValue(-80008)
  valueMinus80008(-80008),
  @JsonValue(-80009)
  valueMinus80009(-80009),
  @JsonValue(-80010)
  valueMinus80010(-80010),
  @JsonValue(-80011)
  valueMinus80011(-80011),
  /// Default value for all unparsed values, allows backward compatibility when adding new values on the backend.
  $unknown(null);

  const DevicesThirdPartyErrorCode(this.json);

  factory DevicesThirdPartyErrorCode.fromJson(num json) => values.firstWhere(
        (e) => e.json == json,
        orElse: () => $unknown,
      );

  final num? json;
}
