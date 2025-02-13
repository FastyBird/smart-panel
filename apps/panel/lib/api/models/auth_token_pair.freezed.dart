// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_token_pair.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthTokenPair _$AuthTokenPairFromJson(Map<String, dynamic> json) {
  return _AuthTokenPair.fromJson(json);
}

/// @nodoc
mixin _$AuthTokenPair {
  /// The JWT access token for authenticated sessions.
  @JsonKey(name: 'access_token')
  String get accessToken => throw _privateConstructorUsedError;

  /// The JWT refresh token for authenticated sessions.
  @JsonKey(name: 'refresh_token')
  String get refreshToken => throw _privateConstructorUsedError;

  /// The JWT access token expiration date.
  DateTime get expiration => throw _privateConstructorUsedError;

  /// Token type
  String get type => throw _privateConstructorUsedError;

  /// Serializes this AuthTokenPair to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthTokenPair
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthTokenPairCopyWith<AuthTokenPair> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthTokenPairCopyWith<$Res> {
  factory $AuthTokenPairCopyWith(
          AuthTokenPair value, $Res Function(AuthTokenPair) then) =
      _$AuthTokenPairCopyWithImpl<$Res, AuthTokenPair>;
  @useResult
  $Res call(
      {@JsonKey(name: 'access_token') String accessToken,
      @JsonKey(name: 'refresh_token') String refreshToken,
      DateTime expiration,
      String type});
}

/// @nodoc
class _$AuthTokenPairCopyWithImpl<$Res, $Val extends AuthTokenPair>
    implements $AuthTokenPairCopyWith<$Res> {
  _$AuthTokenPairCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthTokenPair
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? accessToken = null,
    Object? refreshToken = null,
    Object? expiration = null,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      accessToken: null == accessToken
          ? _value.accessToken
          : accessToken // ignore: cast_nullable_to_non_nullable
              as String,
      refreshToken: null == refreshToken
          ? _value.refreshToken
          : refreshToken // ignore: cast_nullable_to_non_nullable
              as String,
      expiration: null == expiration
          ? _value.expiration
          : expiration // ignore: cast_nullable_to_non_nullable
              as DateTime,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthTokenPairImplCopyWith<$Res>
    implements $AuthTokenPairCopyWith<$Res> {
  factory _$$AuthTokenPairImplCopyWith(
          _$AuthTokenPairImpl value, $Res Function(_$AuthTokenPairImpl) then) =
      __$$AuthTokenPairImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {@JsonKey(name: 'access_token') String accessToken,
      @JsonKey(name: 'refresh_token') String refreshToken,
      DateTime expiration,
      String type});
}

/// @nodoc
class __$$AuthTokenPairImplCopyWithImpl<$Res>
    extends _$AuthTokenPairCopyWithImpl<$Res, _$AuthTokenPairImpl>
    implements _$$AuthTokenPairImplCopyWith<$Res> {
  __$$AuthTokenPairImplCopyWithImpl(
      _$AuthTokenPairImpl _value, $Res Function(_$AuthTokenPairImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthTokenPair
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? accessToken = null,
    Object? refreshToken = null,
    Object? expiration = null,
    Object? type = null,
  }) {
    return _then(_$AuthTokenPairImpl(
      accessToken: null == accessToken
          ? _value.accessToken
          : accessToken // ignore: cast_nullable_to_non_nullable
              as String,
      refreshToken: null == refreshToken
          ? _value.refreshToken
          : refreshToken // ignore: cast_nullable_to_non_nullable
              as String,
      expiration: null == expiration
          ? _value.expiration
          : expiration // ignore: cast_nullable_to_non_nullable
              as DateTime,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthTokenPairImpl implements _AuthTokenPair {
  const _$AuthTokenPairImpl(
      {@JsonKey(name: 'access_token') required this.accessToken,
      @JsonKey(name: 'refresh_token') required this.refreshToken,
      required this.expiration,
      this.type = 'Bearer'});

  factory _$AuthTokenPairImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthTokenPairImplFromJson(json);

  /// The JWT access token for authenticated sessions.
  @override
  @JsonKey(name: 'access_token')
  final String accessToken;

  /// The JWT refresh token for authenticated sessions.
  @override
  @JsonKey(name: 'refresh_token')
  final String refreshToken;

  /// The JWT access token expiration date.
  @override
  final DateTime expiration;

  /// Token type
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'AuthTokenPair(accessToken: $accessToken, refreshToken: $refreshToken, expiration: $expiration, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthTokenPairImpl &&
            (identical(other.accessToken, accessToken) ||
                other.accessToken == accessToken) &&
            (identical(other.refreshToken, refreshToken) ||
                other.refreshToken == refreshToken) &&
            (identical(other.expiration, expiration) ||
                other.expiration == expiration) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, accessToken, refreshToken, expiration, type);

  /// Create a copy of AuthTokenPair
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthTokenPairImplCopyWith<_$AuthTokenPairImpl> get copyWith =>
      __$$AuthTokenPairImplCopyWithImpl<_$AuthTokenPairImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthTokenPairImplToJson(
      this,
    );
  }
}

abstract class _AuthTokenPair implements AuthTokenPair {
  const factory _AuthTokenPair(
      {@JsonKey(name: 'access_token') required final String accessToken,
      @JsonKey(name: 'refresh_token') required final String refreshToken,
      required final DateTime expiration,
      final String type}) = _$AuthTokenPairImpl;

  factory _AuthTokenPair.fromJson(Map<String, dynamic> json) =
      _$AuthTokenPairImpl.fromJson;

  /// The JWT access token for authenticated sessions.
  @override
  @JsonKey(name: 'access_token')
  String get accessToken;

  /// The JWT refresh token for authenticated sessions.
  @override
  @JsonKey(name: 'refresh_token')
  String get refreshToken;

  /// The JWT access token expiration date.
  @override
  DateTime get expiration;

  /// Token type
  @override
  String get type;

  /// Create a copy of AuthTokenPair
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthTokenPairImplCopyWith<_$AuthTokenPairImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
