// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_req_refresh_token.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthReqRefreshToken _$AuthReqRefreshTokenFromJson(Map<String, dynamic> json) {
  return _AuthReqRefreshToken.fromJson(json);
}

/// @nodoc
mixin _$AuthReqRefreshToken {
  AuthRefreshToken get data => throw _privateConstructorUsedError;

  /// Serializes this AuthReqRefreshToken to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthReqRefreshTokenCopyWith<AuthReqRefreshToken> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthReqRefreshTokenCopyWith<$Res> {
  factory $AuthReqRefreshTokenCopyWith(
          AuthReqRefreshToken value, $Res Function(AuthReqRefreshToken) then) =
      _$AuthReqRefreshTokenCopyWithImpl<$Res, AuthReqRefreshToken>;
  @useResult
  $Res call({AuthRefreshToken data});

  $AuthRefreshTokenCopyWith<$Res> get data;
}

/// @nodoc
class _$AuthReqRefreshTokenCopyWithImpl<$Res, $Val extends AuthReqRefreshToken>
    implements $AuthReqRefreshTokenCopyWith<$Res> {
  _$AuthReqRefreshTokenCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_value.copyWith(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthRefreshToken,
    ) as $Val);
  }

  /// Create a copy of AuthReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthRefreshTokenCopyWith<$Res> get data {
    return $AuthRefreshTokenCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthReqRefreshTokenImplCopyWith<$Res>
    implements $AuthReqRefreshTokenCopyWith<$Res> {
  factory _$$AuthReqRefreshTokenImplCopyWith(_$AuthReqRefreshTokenImpl value,
          $Res Function(_$AuthReqRefreshTokenImpl) then) =
      __$$AuthReqRefreshTokenImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthRefreshToken data});

  @override
  $AuthRefreshTokenCopyWith<$Res> get data;
}

/// @nodoc
class __$$AuthReqRefreshTokenImplCopyWithImpl<$Res>
    extends _$AuthReqRefreshTokenCopyWithImpl<$Res, _$AuthReqRefreshTokenImpl>
    implements _$$AuthReqRefreshTokenImplCopyWith<$Res> {
  __$$AuthReqRefreshTokenImplCopyWithImpl(_$AuthReqRefreshTokenImpl _value,
      $Res Function(_$AuthReqRefreshTokenImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$AuthReqRefreshTokenImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthRefreshToken,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthReqRefreshTokenImpl implements _AuthReqRefreshToken {
  const _$AuthReqRefreshTokenImpl({required this.data});

  factory _$AuthReqRefreshTokenImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthReqRefreshTokenImplFromJson(json);

  @override
  final AuthRefreshToken data;

  @override
  String toString() {
    return 'AuthReqRefreshToken(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthReqRefreshTokenImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of AuthReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthReqRefreshTokenImplCopyWith<_$AuthReqRefreshTokenImpl> get copyWith =>
      __$$AuthReqRefreshTokenImplCopyWithImpl<_$AuthReqRefreshTokenImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthReqRefreshTokenImplToJson(
      this,
    );
  }
}

abstract class _AuthReqRefreshToken implements AuthReqRefreshToken {
  const factory _AuthReqRefreshToken({required final AuthRefreshToken data}) =
      _$AuthReqRefreshTokenImpl;

  factory _AuthReqRefreshToken.fromJson(Map<String, dynamic> json) =
      _$AuthReqRefreshTokenImpl.fromJson;

  @override
  AuthRefreshToken get data;

  /// Create a copy of AuthReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthReqRefreshTokenImplCopyWith<_$AuthReqRefreshTokenImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
