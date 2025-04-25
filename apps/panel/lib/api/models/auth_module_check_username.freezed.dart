// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_check_username.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleCheckUsername _$AuthModuleCheckUsernameFromJson(
    Map<String, dynamic> json) {
  return _AuthModuleCheckUsername.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleCheckUsername {
  /// The username to check for availability.
  String get username => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleCheckUsername to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleCheckUsernameCopyWith<AuthModuleCheckUsername> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleCheckUsernameCopyWith<$Res> {
  factory $AuthModuleCheckUsernameCopyWith(AuthModuleCheckUsername value,
          $Res Function(AuthModuleCheckUsername) then) =
      _$AuthModuleCheckUsernameCopyWithImpl<$Res, AuthModuleCheckUsername>;
  @useResult
  $Res call({String username});
}

/// @nodoc
class _$AuthModuleCheckUsernameCopyWithImpl<$Res,
        $Val extends AuthModuleCheckUsername>
    implements $AuthModuleCheckUsernameCopyWith<$Res> {
  _$AuthModuleCheckUsernameCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleCheckUsername
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
abstract class _$$AuthModuleCheckUsernameImplCopyWith<$Res>
    implements $AuthModuleCheckUsernameCopyWith<$Res> {
  factory _$$AuthModuleCheckUsernameImplCopyWith(
          _$AuthModuleCheckUsernameImpl value,
          $Res Function(_$AuthModuleCheckUsernameImpl) then) =
      __$$AuthModuleCheckUsernameImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String username});
}

/// @nodoc
class __$$AuthModuleCheckUsernameImplCopyWithImpl<$Res>
    extends _$AuthModuleCheckUsernameCopyWithImpl<$Res,
        _$AuthModuleCheckUsernameImpl>
    implements _$$AuthModuleCheckUsernameImplCopyWith<$Res> {
  __$$AuthModuleCheckUsernameImplCopyWithImpl(
      _$AuthModuleCheckUsernameImpl _value,
      $Res Function(_$AuthModuleCheckUsernameImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? username = null,
  }) {
    return _then(_$AuthModuleCheckUsernameImpl(
      username: null == username
          ? _value.username
          : username // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleCheckUsernameImpl implements _AuthModuleCheckUsername {
  const _$AuthModuleCheckUsernameImpl({required this.username});

  factory _$AuthModuleCheckUsernameImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleCheckUsernameImplFromJson(json);

  /// The username to check for availability.
  @override
  final String username;

  @override
  String toString() {
    return 'AuthModuleCheckUsername(username: $username)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleCheckUsernameImpl &&
            (identical(other.username, username) ||
                other.username == username));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, username);

  /// Create a copy of AuthModuleCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleCheckUsernameImplCopyWith<_$AuthModuleCheckUsernameImpl>
      get copyWith => __$$AuthModuleCheckUsernameImplCopyWithImpl<
          _$AuthModuleCheckUsernameImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleCheckUsernameImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleCheckUsername implements AuthModuleCheckUsername {
  const factory _AuthModuleCheckUsername({required final String username}) =
      _$AuthModuleCheckUsernameImpl;

  factory _AuthModuleCheckUsername.fromJson(Map<String, dynamic> json) =
      _$AuthModuleCheckUsernameImpl.fromJson;

  /// The username to check for availability.
  @override
  String get username;

  /// Create a copy of AuthModuleCheckUsername
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleCheckUsernameImplCopyWith<_$AuthModuleCheckUsernameImpl>
      get copyWith => throw _privateConstructorUsedError;
}
