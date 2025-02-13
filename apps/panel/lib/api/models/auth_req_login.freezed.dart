// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_req_login.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthReqLogin _$AuthReqLoginFromJson(Map<String, dynamic> json) {
  return _AuthReqLogin.fromJson(json);
}

/// @nodoc
mixin _$AuthReqLogin {
  AuthLogin get data => throw _privateConstructorUsedError;

  /// Serializes this AuthReqLogin to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthReqLogin
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthReqLoginCopyWith<AuthReqLogin> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthReqLoginCopyWith<$Res> {
  factory $AuthReqLoginCopyWith(
          AuthReqLogin value, $Res Function(AuthReqLogin) then) =
      _$AuthReqLoginCopyWithImpl<$Res, AuthReqLogin>;
  @useResult
  $Res call({AuthLogin data});

  $AuthLoginCopyWith<$Res> get data;
}

/// @nodoc
class _$AuthReqLoginCopyWithImpl<$Res, $Val extends AuthReqLogin>
    implements $AuthReqLoginCopyWith<$Res> {
  _$AuthReqLoginCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthReqLogin
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
              as AuthLogin,
    ) as $Val);
  }

  /// Create a copy of AuthReqLogin
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthLoginCopyWith<$Res> get data {
    return $AuthLoginCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthReqLoginImplCopyWith<$Res>
    implements $AuthReqLoginCopyWith<$Res> {
  factory _$$AuthReqLoginImplCopyWith(
          _$AuthReqLoginImpl value, $Res Function(_$AuthReqLoginImpl) then) =
      __$$AuthReqLoginImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthLogin data});

  @override
  $AuthLoginCopyWith<$Res> get data;
}

/// @nodoc
class __$$AuthReqLoginImplCopyWithImpl<$Res>
    extends _$AuthReqLoginCopyWithImpl<$Res, _$AuthReqLoginImpl>
    implements _$$AuthReqLoginImplCopyWith<$Res> {
  __$$AuthReqLoginImplCopyWithImpl(
      _$AuthReqLoginImpl _value, $Res Function(_$AuthReqLoginImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthReqLogin
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$AuthReqLoginImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthLogin,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthReqLoginImpl implements _AuthReqLogin {
  const _$AuthReqLoginImpl({required this.data});

  factory _$AuthReqLoginImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthReqLoginImplFromJson(json);

  @override
  final AuthLogin data;

  @override
  String toString() {
    return 'AuthReqLogin(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthReqLoginImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of AuthReqLogin
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthReqLoginImplCopyWith<_$AuthReqLoginImpl> get copyWith =>
      __$$AuthReqLoginImplCopyWithImpl<_$AuthReqLoginImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthReqLoginImplToJson(
      this,
    );
  }
}

abstract class _AuthReqLogin implements AuthReqLogin {
  const factory _AuthReqLogin({required final AuthLogin data}) =
      _$AuthReqLoginImpl;

  factory _AuthReqLogin.fromJson(Map<String, dynamic> json) =
      _$AuthReqLoginImpl.fromJson;

  @override
  AuthLogin get data;

  /// Create a copy of AuthReqLogin
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthReqLoginImplCopyWith<_$AuthReqLoginImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
