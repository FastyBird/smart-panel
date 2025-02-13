// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_display_secret.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthDisplaySecret _$AuthDisplaySecretFromJson(Map<String, dynamic> json) {
  return _AuthDisplaySecret.fromJson(json);
}

/// @nodoc
mixin _$AuthDisplaySecret {
  /// Display account secret
  String get secret => throw _privateConstructorUsedError;

  /// Serializes this AuthDisplaySecret to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthDisplaySecretCopyWith<AuthDisplaySecret> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthDisplaySecretCopyWith<$Res> {
  factory $AuthDisplaySecretCopyWith(
          AuthDisplaySecret value, $Res Function(AuthDisplaySecret) then) =
      _$AuthDisplaySecretCopyWithImpl<$Res, AuthDisplaySecret>;
  @useResult
  $Res call({String secret});
}

/// @nodoc
class _$AuthDisplaySecretCopyWithImpl<$Res, $Val extends AuthDisplaySecret>
    implements $AuthDisplaySecretCopyWith<$Res> {
  _$AuthDisplaySecretCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? secret = null,
  }) {
    return _then(_value.copyWith(
      secret: null == secret
          ? _value.secret
          : secret // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthDisplaySecretImplCopyWith<$Res>
    implements $AuthDisplaySecretCopyWith<$Res> {
  factory _$$AuthDisplaySecretImplCopyWith(_$AuthDisplaySecretImpl value,
          $Res Function(_$AuthDisplaySecretImpl) then) =
      __$$AuthDisplaySecretImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String secret});
}

/// @nodoc
class __$$AuthDisplaySecretImplCopyWithImpl<$Res>
    extends _$AuthDisplaySecretCopyWithImpl<$Res, _$AuthDisplaySecretImpl>
    implements _$$AuthDisplaySecretImplCopyWith<$Res> {
  __$$AuthDisplaySecretImplCopyWithImpl(_$AuthDisplaySecretImpl _value,
      $Res Function(_$AuthDisplaySecretImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? secret = null,
  }) {
    return _then(_$AuthDisplaySecretImpl(
      secret: null == secret
          ? _value.secret
          : secret // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthDisplaySecretImpl implements _AuthDisplaySecret {
  const _$AuthDisplaySecretImpl({required this.secret});

  factory _$AuthDisplaySecretImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthDisplaySecretImplFromJson(json);

  /// Display account secret
  @override
  final String secret;

  @override
  String toString() {
    return 'AuthDisplaySecret(secret: $secret)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthDisplaySecretImpl &&
            (identical(other.secret, secret) || other.secret == secret));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, secret);

  /// Create a copy of AuthDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthDisplaySecretImplCopyWith<_$AuthDisplaySecretImpl> get copyWith =>
      __$$AuthDisplaySecretImplCopyWithImpl<_$AuthDisplaySecretImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthDisplaySecretImplToJson(
      this,
    );
  }
}

abstract class _AuthDisplaySecret implements AuthDisplaySecret {
  const factory _AuthDisplaySecret({required final String secret}) =
      _$AuthDisplaySecretImpl;

  factory _AuthDisplaySecret.fromJson(Map<String, dynamic> json) =
      _$AuthDisplaySecretImpl.fromJson;

  /// Display account secret
  @override
  String get secret;

  /// Create a copy of AuthDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthDisplaySecretImplCopyWith<_$AuthDisplaySecretImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
