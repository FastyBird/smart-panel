// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:freezed_annotation/freezed_annotation.dart';

part 'parent2.freezed.dart';
part 'parent2.g.dart';

@Freezed()
class Parent2 with _$Parent2 {
  const factory Parent2({
    /// A unique parent identifier.
    required String id,

    /// Discriminator for the data source parent
    required String type,
  }) = _Parent2;
  
  factory Parent2.fromJson(Map<String, Object?> json) => _$Parent2FromJson(json);
}
