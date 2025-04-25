// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_req_refresh_token.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleReqRefreshToken _$AuthModuleReqRefreshTokenFromJson(
    Map<String, dynamic> json) {
  return _AuthModuleReqRefreshToken.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleReqRefreshToken {
  AuthModuleRefreshToken get data => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleReqRefreshToken to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleReqRefreshTokenCopyWith<AuthModuleReqRefreshToken> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleReqRefreshTokenCopyWith<$Res> {
  factory $AuthModuleReqRefreshTokenCopyWith(AuthModuleReqRefreshToken value,
          $Res Function(AuthModuleReqRefreshToken) then) =
      _$AuthModuleReqRefreshTokenCopyWithImpl<$Res, AuthModuleReqRefreshToken>;
  @useResult
  $Res call({AuthModuleRefreshToken data});

  $AuthModuleRefreshTokenCopyWith<$Res> get data;
}

/// @nodoc
class _$AuthModuleReqRefreshTokenCopyWithImpl<$Res,
        $Val extends AuthModuleReqRefreshToken>
    implements $AuthModuleReqRefreshTokenCopyWith<$Res> {
  _$AuthModuleReqRefreshTokenCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleReqRefreshToken
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
              as AuthModuleRefreshToken,
    ) as $Val);
  }

  /// Create a copy of AuthModuleReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthModuleRefreshTokenCopyWith<$Res> get data {
    return $AuthModuleRefreshTokenCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthModuleReqRefreshTokenImplCopyWith<$Res>
    implements $AuthModuleReqRefreshTokenCopyWith<$Res> {
  factory _$$AuthModuleReqRefreshTokenImplCopyWith(
          _$AuthModuleReqRefreshTokenImpl value,
          $Res Function(_$AuthModuleReqRefreshTokenImpl) then) =
      __$$AuthModuleReqRefreshTokenImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthModuleRefreshToken data});

  @override
  $AuthModuleRefreshTokenCopyWith<$Res> get data;
}

/// @nodoc
class __$$AuthModuleReqRefreshTokenImplCopyWithImpl<$Res>
    extends _$AuthModuleReqRefreshTokenCopyWithImpl<$Res,
        _$AuthModuleReqRefreshTokenImpl>
    implements _$$AuthModuleReqRefreshTokenImplCopyWith<$Res> {
  __$$AuthModuleReqRefreshTokenImplCopyWithImpl(
      _$AuthModuleReqRefreshTokenImpl _value,
      $Res Function(_$AuthModuleReqRefreshTokenImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$AuthModuleReqRefreshTokenImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthModuleRefreshToken,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleReqRefreshTokenImpl implements _AuthModuleReqRefreshToken {
  const _$AuthModuleReqRefreshTokenImpl({required this.data});

  factory _$AuthModuleReqRefreshTokenImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleReqRefreshTokenImplFromJson(json);

  @override
  final AuthModuleRefreshToken data;

  @override
  String toString() {
    return 'AuthModuleReqRefreshToken(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleReqRefreshTokenImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of AuthModuleReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleReqRefreshTokenImplCopyWith<_$AuthModuleReqRefreshTokenImpl>
      get copyWith => __$$AuthModuleReqRefreshTokenImplCopyWithImpl<
          _$AuthModuleReqRefreshTokenImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleReqRefreshTokenImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleReqRefreshToken implements AuthModuleReqRefreshToken {
  const factory _AuthModuleReqRefreshToken(
          {required final AuthModuleRefreshToken data}) =
      _$AuthModuleReqRefreshTokenImpl;

  factory _AuthModuleReqRefreshToken.fromJson(Map<String, dynamic> json) =
      _$AuthModuleReqRefreshTokenImpl.fromJson;

  @override
  AuthModuleRefreshToken get data;

  /// Create a copy of AuthModuleReqRefreshToken
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleReqRefreshTokenImplCopyWith<_$AuthModuleReqRefreshTokenImpl>
      get copyWith => throw _privateConstructorUsedError;
}
