// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_check_username.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthCheckUsername _$AuthCheckUsernameFromJson(Map<String, dynamic> json) {
  return _AuthCheckUsername.fromJson(json);
}

/// @nodoc
mixin _$AuthCheckUsername {
  /// The username to check for availability.
  String get username => throw _privateConstructorUsedError;

  /// Serializes this AuthCheckUsername to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthCheckUsernameCopyWith<AuthCheckUsername> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthCheckUsernameCopyWith<$Res> {
  factory $AuthCheckUsernameCopyWith(
          AuthCheckUsername value, $Res Function(AuthCheckUsername) then) =
      _$AuthCheckUsernameCopyWithImpl<$Res, AuthCheckUsername>;
  @useResult
  $Res call({String username});
}

/// @nodoc
class _$AuthCheckUsernameCopyWithImpl<$Res, $Val extends AuthCheckUsername>
    implements $AuthCheckUsernameCopyWith<$Res> {
  _$AuthCheckUsernameCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? username = null,
  }) {
    return _then(_value.copyWith(
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthCheckUsernameImplCopyWith<$Res>
    implements $AuthCheckUsernameCopyWith<$Res> {
  factory _$$AuthCheckUsernameImplCopyWith(_$AuthCheckUsernameImpl value,
          $Res Function(_$AuthCheckUsernameImpl) then) =
      __$$AuthCheckUsernameImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String username});
}

/// @nodoc
class __$$AuthCheckUsernameImplCopyWithImpl<$Res>
    extends _$AuthCheckUsernameCopyWithImpl<$Res, _$AuthCheckUsernameImpl>
    implements _$$AuthCheckUsernameImplCopyWith<$Res> {
  __$$AuthCheckUsernameImplCopyWithImpl(_$AuthCheckUsernameImpl _value,
      $Res Function(_$AuthCheckUsernameImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? username = null,
  }) {
    return _then(_$AuthCheckUsernameImpl(
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthCheckUsernameImpl implements _AuthCheckUsername {
  const _$AuthCheckUsernameImpl({required this.username});

  factory _$AuthCheckUsernameImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthCheckUsernameImplFromJson(json);

  /// The username to check for availability.
  @override
  final String username;

  @override
  String toString() {
    return 'AuthCheckUsername(username: $username)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthCheckUsernameImpl &&
            (identical(other.username, username) ||
                other.username == username));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, username);

  /// Create a copy of AuthCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthCheckUsernameImplCopyWith<_$AuthCheckUsernameImpl> get copyWith =>
      __$$AuthCheckUsernameImplCopyWithImpl<_$AuthCheckUsernameImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthCheckUsernameImplToJson(
      this,
    );
  }
}

abstract class _AuthCheckUsername implements AuthCheckUsername {
  const factory _AuthCheckUsername({required final String username}) =
      _$AuthCheckUsernameImpl;

  factory _AuthCheckUsername.fromJson(Map<String, dynamic> json) =
      _$AuthCheckUsernameImpl.fromJson;

  /// The username to check for availability.
  @override
  String get username;

  /// Create a copy of AuthCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthCheckUsernameImplCopyWith<_$AuthCheckUsernameImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
