// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'parent.freezed.dart';
part 'parent.g.dart';

@Freezed()
class Parent with _$Parent {
  const factory Parent({
    /// A unique parent identifier.
    required String id,

    /// Discriminator for the tile parent
    required String type,
  }) = _Parent;
  
  factory Parent.fromJson(Map<String, Object?> json) => _$ParentFromJson(json);
}
