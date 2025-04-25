// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_display_secret.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleDisplaySecret _$AuthModuleDisplaySecretFromJson(
    Map<String, dynamic> json) {
  return _AuthModuleDisplaySecret.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleDisplaySecret {
  /// Display account secret
  String get secret => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleDisplaySecret to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleDisplaySecretCopyWith<AuthModuleDisplaySecret> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleDisplaySecretCopyWith<$Res> {
  factory $AuthModuleDisplaySecretCopyWith(AuthModuleDisplaySecret value,
          $Res Function(AuthModuleDisplaySecret) then) =
      _$AuthModuleDisplaySecretCopyWithImpl<$Res, AuthModuleDisplaySecret>;
  @useResult
  $Res call({String secret});
}

/// @nodoc
class _$AuthModuleDisplaySecretCopyWithImpl<$Res,
        $Val extends AuthModuleDisplaySecret>
    implements $AuthModuleDisplaySecretCopyWith<$Res> {
  _$AuthModuleDisplaySecretCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleDisplaySecret
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
abstract class _$$AuthModuleDisplaySecretImplCopyWith<$Res>
    implements $AuthModuleDisplaySecretCopyWith<$Res> {
  factory _$$AuthModuleDisplaySecretImplCopyWith(
          _$AuthModuleDisplaySecretImpl value,
          $Res Function(_$AuthModuleDisplaySecretImpl) then) =
      __$$AuthModuleDisplaySecretImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String secret});
}

/// @nodoc
class __$$AuthModuleDisplaySecretImplCopyWithImpl<$Res>
    extends _$AuthModuleDisplaySecretCopyWithImpl<$Res,
        _$AuthModuleDisplaySecretImpl>
    implements _$$AuthModuleDisplaySecretImplCopyWith<$Res> {
  __$$AuthModuleDisplaySecretImplCopyWithImpl(
      _$AuthModuleDisplaySecretImpl _value,
      $Res Function(_$AuthModuleDisplaySecretImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? secret = null,
  }) {
    return _then(_$AuthModuleDisplaySecretImpl(
      secret: null == secret
          ? _value.secret
          : secret // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleDisplaySecretImpl implements _AuthModuleDisplaySecret {
  const _$AuthModuleDisplaySecretImpl({required this.secret});

  factory _$AuthModuleDisplaySecretImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleDisplaySecretImplFromJson(json);

  /// Display account secret
  @override
  final String secret;

  @override
  String toString() {
    return 'AuthModuleDisplaySecret(secret: $secret)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleDisplaySecretImpl &&
            (identical(other.secret, secret) || other.secret == secret));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, secret);

  /// Create a copy of AuthModuleDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleDisplaySecretImplCopyWith<_$AuthModuleDisplaySecretImpl>
      get copyWith => __$$AuthModuleDisplaySecretImplCopyWithImpl<
          _$AuthModuleDisplaySecretImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleDisplaySecretImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleDisplaySecret implements AuthModuleDisplaySecret {
  const factory _AuthModuleDisplaySecret({required final String secret}) =
      _$AuthModuleDisplaySecretImpl;

  factory _AuthModuleDisplaySecret.fromJson(Map<String, dynamic> json) =
      _$AuthModuleDisplaySecretImpl.fromJson;

  /// Display account secret
  @override
  String get secret;

  /// Create a copy of AuthModuleDisplaySecret
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleDisplaySecretImplCopyWith<_$AuthModuleDisplaySecretImpl>
      get copyWith => throw _privateConstructorUsedError;
}
