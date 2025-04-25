// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_refresh_token.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleRefreshToken _$AuthModuleRefreshTokenFromJson(
    Map<String, dynamic> json) {
  return _AuthModuleRefreshToken.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleRefreshToken {
  /// JWT refresh access token
  String get token => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleRefreshToken to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleRefreshTokenCopyWith<AuthModuleRefreshToken> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleRefreshTokenCopyWith<$Res> {
  factory $AuthModuleRefreshTokenCopyWith(AuthModuleRefreshToken value,
          $Res Function(AuthModuleRefreshToken) then) =
      _$AuthModuleRefreshTokenCopyWithImpl<$Res, AuthModuleRefreshToken>;
  @useResult
  $Res call({String token});
}

/// @nodoc
class _$AuthModuleRefreshTokenCopyWithImpl<$Res,
        $Val extends AuthModuleRefreshToken>
    implements $AuthModuleRefreshTokenCopyWith<$Res> {
  _$AuthModuleRefreshTokenCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleRefreshToken
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
abstract class _$$AuthModuleRefreshTokenImplCopyWith<$Res>
    implements $AuthModuleRefreshTokenCopyWith<$Res> {
  factory _$$AuthModuleRefreshTokenImplCopyWith(
          _$AuthModuleRefreshTokenImpl value,
          $Res Function(_$AuthModuleRefreshTokenImpl) then) =
      __$$AuthModuleRefreshTokenImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String token});
}

/// @nodoc
class __$$AuthModuleRefreshTokenImplCopyWithImpl<$Res>
    extends _$AuthModuleRefreshTokenCopyWithImpl<$Res,
        _$AuthModuleRefreshTokenImpl>
    implements _$$AuthModuleRefreshTokenImplCopyWith<$Res> {
  __$$AuthModuleRefreshTokenImplCopyWithImpl(
      _$AuthModuleRefreshTokenImpl _value,
      $Res Function(_$AuthModuleRefreshTokenImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? token = null,
  }) {
    return _then(_$AuthModuleRefreshTokenImpl(
      token: null == token
          ? _value.token
          : token // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleRefreshTokenImpl implements _AuthModuleRefreshToken {
  const _$AuthModuleRefreshTokenImpl({required this.token});

  factory _$AuthModuleRefreshTokenImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleRefreshTokenImplFromJson(json);

  /// JWT refresh access token
  @override
  final String token;

  @override
  String toString() {
    return 'AuthModuleRefreshToken(token: $token)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleRefreshTokenImpl &&
            (identical(other.token, token) || other.token == token));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, token);

  /// Create a copy of AuthModuleRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleRefreshTokenImplCopyWith<_$AuthModuleRefreshTokenImpl>
      get copyWith => __$$AuthModuleRefreshTokenImplCopyWithImpl<
          _$AuthModuleRefreshTokenImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleRefreshTokenImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleRefreshToken implements AuthModuleRefreshToken {
  const factory _AuthModuleRefreshToken({required final String token}) =
      _$AuthModuleRefreshTokenImpl;

  factory _AuthModuleRefreshToken.fromJson(Map<String, dynamic> json) =
      _$AuthModuleRefreshTokenImpl.fromJson;

  /// JWT refresh access token
  @override
  String get token;

  /// Create a copy of AuthModuleRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleRefreshTokenImplCopyWith<_$AuthModuleRefreshTokenImpl>
      get copyWith => throw _privateConstructorUsedError;
}
