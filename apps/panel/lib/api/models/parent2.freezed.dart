// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'parent2.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

Parent2 _$Parent2FromJson(Map<String, dynamic> json) {
  return _Parent2.fromJson(json);
}

/// @nodoc
mixin _$Parent2 {
  /// A unique parent identifier.
  String get id => throw _privateConstructorUsedError;

  /// Discriminator for the data source parent
  String get type => throw _privateConstructorUsedError;

  /// Serializes this Parent2 to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of Parent2
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $Parent2CopyWith<Parent2> get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $Parent2CopyWith<$Res> {
  factory $Parent2CopyWith(Parent2 value, $Res Function(Parent2) then) =
      _$Parent2CopyWithImpl<$Res, Parent2>;
  @useResult
  $Res call({String id, String type});
}

/// @nodoc
class _$Parent2CopyWithImpl<$Res, $Val extends Parent2>
    implements $Parent2CopyWith<$Res> {
  _$Parent2CopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of Parent2
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$Parent2ImplCopyWith<$Res> implements $Parent2CopyWith<$Res> {
  factory _$$Parent2ImplCopyWith(
          _$Parent2Impl value, $Res Function(_$Parent2Impl) then) =
      __$$Parent2ImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String id, String type});
}

/// @nodoc
class __$$Parent2ImplCopyWithImpl<$Res>
    extends _$Parent2CopyWithImpl<$Res, _$Parent2Impl>
    implements _$$Parent2ImplCopyWith<$Res> {
  __$$Parent2ImplCopyWithImpl(
      _$Parent2Impl _value, $Res Function(_$Parent2Impl) _then)
      : super(_value, _then);

  /// Create a copy of Parent2
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
  }) {
    return _then(_$Parent2Impl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$Parent2Impl implements _Parent2 {
  const _$Parent2Impl({required this.id, required this.type});

  factory _$Parent2Impl.fromJson(Map<String, dynamic> json) =>
      _$$Parent2ImplFromJson(json);

  /// A unique parent identifier.
  @override
  final String id;

  /// Discriminator for the data source parent
  @override
  final String type;

  @override
  String toString() {
    return 'Parent2(id: $id, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$Parent2Impl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, type);

  /// Create a copy of Parent2
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$Parent2ImplCopyWith<_$Parent2Impl> get copyWith =>
      __$$Parent2ImplCopyWithImpl<_$Parent2Impl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$Parent2ImplToJson(
      this,
    );
  }
}

abstract class _Parent2 implements Parent2 {
  const factory _Parent2(
      {required final String id, required final String type}) = _$Parent2Impl;

  factory _Parent2.fromJson(Map<String, dynamic> json) = _$Parent2Impl.fromJson;

  /// A unique parent identifier.
  @override
  String get id;

  /// Discriminator for the data source parent
  @override
  String get type;

  /// Create a copy of Parent2
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$Parent2ImplCopyWith<_$Parent2Impl> get copyWith =>
      throw _privateConstructorUsedError;
}
