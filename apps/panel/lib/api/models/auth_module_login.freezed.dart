// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_login.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleLogin _$AuthModuleLoginFromJson(Map<String, dynamic> json) {
  return _AuthModuleLogin.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleLogin {
  /// The username of the user.
  String get username => throw _privateConstructorUsedError;

  /// The user's password.
  String get password => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleLogin to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleLogin
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleLoginCopyWith<AuthModuleLogin> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleLoginCopyWith<$Res> {
  factory $AuthModuleLoginCopyWith(
          AuthModuleLogin value, $Res Function(AuthModuleLogin) then) =
      _$AuthModuleLoginCopyWithImpl<$Res, AuthModuleLogin>;
  @useResult
  $Res call({String username, String password});
}

/// @nodoc
class _$AuthModuleLoginCopyWithImpl<$Res, $Val extends AuthModuleLogin>
    implements $AuthModuleLoginCopyWith<$Res> {
  _$AuthModuleLoginCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleLogin
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? username = null,
    Object? password = null,
  }) {
    return _then(_value.copyWith(
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthModuleLoginImplCopyWith<$Res>
    implements $AuthModuleLoginCopyWith<$Res> {
  factory _$$AuthModuleLoginImplCopyWith(_$AuthModuleLoginImpl value,
          $Res Function(_$AuthModuleLoginImpl) then) =
      __$$AuthModuleLoginImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String username, String password});
}

/// @nodoc
class __$$AuthModuleLoginImplCopyWithImpl<$Res>
    extends _$AuthModuleLoginCopyWithImpl<$Res, _$AuthModuleLoginImpl>
    implements _$$AuthModuleLoginImplCopyWith<$Res> {
  __$$AuthModuleLoginImplCopyWithImpl(
      _$AuthModuleLoginImpl _value, $Res Function(_$AuthModuleLoginImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleLogin
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? username = null,
    Object? password = null,
  }) {
    return _then(_$AuthModuleLoginImpl(
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleLoginImpl implements _AuthModuleLogin {
  const _$AuthModuleLoginImpl({required this.username, required this.password});

  factory _$AuthModuleLoginImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleLoginImplFromJson(json);

  /// The username of the user.
  @override
  final String username;

  /// The user's password.
  @override
  final String password;

  @override
  String toString() {
    return 'AuthModuleLogin(username: $username, password: $password)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleLoginImpl &&
            (identical(other.username, username) ||
                other.username == username) &&
            (identical(other.password, password) ||
                other.password == password));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, username, password);

  /// Create a copy of AuthModuleLogin
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleLoginImplCopyWith<_$AuthModuleLoginImpl> get copyWith =>
      __$$AuthModuleLoginImplCopyWithImpl<_$AuthModuleLoginImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleLoginImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleLogin implements AuthModuleLogin {
  const factory _AuthModuleLogin(
      {required final String username,
      required final String password}) = _$AuthModuleLoginImpl;

  factory _AuthModuleLogin.fromJson(Map<String, dynamic> json) =
      _$AuthModuleLoginImpl.fromJson;

  /// The username of the user.
  @override
  String get username;

  /// The user's password.
  @override
  String get password;

  /// Create a copy of AuthModuleLogin
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleLoginImplCopyWith<_$AuthModuleLoginImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
