// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_register.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleRegister _$AuthModuleRegisterFromJson(Map<String, dynamic> json) {
  return _AuthModuleRegister.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleRegister {
  /// Unique identifier for the user.
  String get username => throw _privateConstructorUsedError;

  /// User's password. Must be at least 6 characters long.
  String get password => throw _privateConstructorUsedError;

  /// Optional user's email address.
  String get email => throw _privateConstructorUsedError;

  /// Optional user's first name.
  @JsonKey(name: 'first_name')
  String get firstName => throw _privateConstructorUsedError;

  /// Optional user's last name.
  @JsonKey(name: 'last_name')
  String get lastName => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleRegister to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleRegister
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleRegisterCopyWith<AuthModuleRegister> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleRegisterCopyWith<$Res> {
  factory $AuthModuleRegisterCopyWith(
          AuthModuleRegister value, $Res Function(AuthModuleRegister) then) =
      _$AuthModuleRegisterCopyWithImpl<$Res, AuthModuleRegister>;
  @useResult
  $Res call(
      {String username,
      String password,
      String email,
      @JsonKey(name: 'first_name') String firstName,
      @JsonKey(name: 'last_name') String lastName});
}

/// @nodoc
class _$AuthModuleRegisterCopyWithImpl<$Res, $Val extends AuthModuleRegister>
    implements $AuthModuleRegisterCopyWith<$Res> {
  _$AuthModuleRegisterCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleRegister
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? username = null,
    Object? password = null,
    Object? email = null,
    Object? firstName = null,
    Object? lastName = null,
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
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthModuleRegisterImplCopyWith<$Res>
    implements $AuthModuleRegisterCopyWith<$Res> {
  factory _$$AuthModuleRegisterImplCopyWith(_$AuthModuleRegisterImpl value,
          $Res Function(_$AuthModuleRegisterImpl) then) =
      __$$AuthModuleRegisterImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String username,
      String password,
      String email,
      @JsonKey(name: 'first_name') String firstName,
      @JsonKey(name: 'last_name') String lastName});
}

/// @nodoc
class __$$AuthModuleRegisterImplCopyWithImpl<$Res>
    extends _$AuthModuleRegisterCopyWithImpl<$Res, _$AuthModuleRegisterImpl>
    implements _$$AuthModuleRegisterImplCopyWith<$Res> {
  __$$AuthModuleRegisterImplCopyWithImpl(_$AuthModuleRegisterImpl _value,
      $Res Function(_$AuthModuleRegisterImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleRegister
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? username = null,
    Object? password = null,
    Object? email = null,
    Object? firstName = null,
    Object? lastName = null,
  }) {
    return _then(_$AuthModuleRegisterImpl(
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
      password: null == password
          ? _value.password
          : password // ignore: cast_nullable_to_non_nullable
              as String,
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
      firstName: null == firstName
          ? _value.firstName
          : firstName // ignore: cast_nullable_to_non_nullable
              as String,
      lastName: null == lastName
          ? _value.lastName
          : lastName // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleRegisterImpl implements _AuthModuleRegister {
  const _$AuthModuleRegisterImpl(
      {required this.username,
      required this.password,
      required this.email,
      @JsonKey(name: 'first_name') required this.firstName,
      @JsonKey(name: 'last_name') required this.lastName});

  factory _$AuthModuleRegisterImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleRegisterImplFromJson(json);

  /// Unique identifier for the user.
  @override
  final String username;

  /// User's password. Must be at least 6 characters long.
  @override
  final String password;

  /// Optional user's email address.
  @override
  final String email;

  /// Optional user's first name.
  @override
  @JsonKey(name: 'first_name')
  final String firstName;

  /// Optional user's last name.
  @override
  @JsonKey(name: 'last_name')
  final String lastName;

  @override
  String toString() {
    return 'AuthModuleRegister(username: $username, password: $password, email: $email, firstName: $firstName, lastName: $lastName)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleRegisterImpl &&
            (identical(other.username, username) ||
                other.username == username) &&
            (identical(other.password, password) ||
                other.password == password) &&
            (identical(other.email, email) || other.email == email) &&
            (identical(other.firstName, firstName) ||
                other.firstName == firstName) &&
            (identical(other.lastName, lastName) ||
                other.lastName == lastName));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, username, password, email, firstName, lastName);

  /// Create a copy of AuthModuleRegister
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleRegisterImplCopyWith<_$AuthModuleRegisterImpl> get copyWith =>
      __$$AuthModuleRegisterImplCopyWithImpl<_$AuthModuleRegisterImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleRegisterImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleRegister implements AuthModuleRegister {
  const factory _AuthModuleRegister(
          {required final String username,
          required final String password,
          required final String email,
          @JsonKey(name: 'first_name') required final String firstName,
          @JsonKey(name: 'last_name') required final String lastName}) =
      _$AuthModuleRegisterImpl;

  factory _AuthModuleRegister.fromJson(Map<String, dynamic> json) =
      _$AuthModuleRegisterImpl.fromJson;

  /// Unique identifier for the user.
  @override
  String get username;

  /// User's password. Must be at least 6 characters long.
  @override
  String get password;

  /// Optional user's email address.
  @override
  String get email;

  /// Optional user's first name.
  @override
  @JsonKey(name: 'first_name')
  String get firstName;

  /// Optional user's last name.
  @override
  @JsonKey(name: 'last_name')
  String get lastName;

  /// Create a copy of AuthModuleRegister
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleRegisterImplCopyWith<_$AuthModuleRegisterImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
