// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_refresh_token.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthRefreshToken _$AuthRefreshTokenFromJson(Map<String, dynamic> json) {
  return _AuthRefreshToken.fromJson(json);
}

/// @nodoc
mixin _$AuthRefreshToken {
  /// JWT refresh access token
  String get token => throw _privateConstructorUsedError;

  /// Serializes this AuthRefreshToken to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthRefreshTokenCopyWith<AuthRefreshToken> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthRefreshTokenCopyWith<$Res> {
  factory $AuthRefreshTokenCopyWith(
          AuthRefreshToken value, $Res Function(AuthRefreshToken) then) =
      _$AuthRefreshTokenCopyWithImpl<$Res, AuthRefreshToken>;
  @useResult
  $Res call({String token});
}

/// @nodoc
class _$AuthRefreshTokenCopyWithImpl<$Res, $Val extends AuthRefreshToken>
    implements $AuthRefreshTokenCopyWith<$Res> {
  _$AuthRefreshTokenCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? token = null,
  }) {
    return _then(_value.copyWith(
      token: null == token
          ? _value.token
          : token // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthRefreshTokenImplCopyWith<$Res>
    implements $AuthRefreshTokenCopyWith<$Res> {
  factory _$$AuthRefreshTokenImplCopyWith(_$AuthRefreshTokenImpl value,
          $Res Function(_$AuthRefreshTokenImpl) then) =
      __$$AuthRefreshTokenImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String token});
}

/// @nodoc
class __$$AuthRefreshTokenImplCopyWithImpl<$Res>
    extends _$AuthRefreshTokenCopyWithImpl<$Res, _$AuthRefreshTokenImpl>
    implements _$$AuthRefreshTokenImplCopyWith<$Res> {
  __$$AuthRefreshTokenImplCopyWithImpl(_$AuthRefreshTokenImpl _value,
      $Res Function(_$AuthRefreshTokenImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? token = null,
  }) {
    return _then(_$AuthRefreshTokenImpl(
      token: null == token
          ? _value.token
          : token // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthRefreshTokenImpl implements _AuthRefreshToken {
  const _$AuthRefreshTokenImpl({required this.token});

  factory _$AuthRefreshTokenImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthRefreshTokenImplFromJson(json);

  /// JWT refresh access token
  @override
  final String token;

  @override
  String toString() {
    return 'AuthRefreshToken(token: $token)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthRefreshTokenImpl &&
            (identical(other.token, token) || other.token == token));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, token);

  /// Create a copy of AuthRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthRefreshTokenImplCopyWith<_$AuthRefreshTokenImpl> get copyWith =>
      __$$AuthRefreshTokenImplCopyWithImpl<_$AuthRefreshTokenImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthRefreshTokenImplToJson(
      this,
    );
  }
}

abstract class _AuthRefreshToken implements AuthRefreshToken {
  const factory _AuthRefreshToken({required final String token}) =
      _$AuthRefreshTokenImpl;

  factory _AuthRefreshToken.fromJson(Map<String, dynamic> json) =
      _$AuthRefreshTokenImpl.fromJson;

  /// JWT refresh access token
  @override
  String get token;

  /// Create a copy of AuthRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthRefreshTokenImplCopyWith<_$AuthRefreshTokenImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
