// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_check_email.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleCheckEmail _$AuthModuleCheckEmailFromJson(Map<String, dynamic> json) {
  return _AuthModuleCheckEmail.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleCheckEmail {
  /// The email address to check for availability.
  String get email => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleCheckEmail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleCheckEmailCopyWith<AuthModuleCheckEmail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleCheckEmailCopyWith<$Res> {
  factory $AuthModuleCheckEmailCopyWith(AuthModuleCheckEmail value,
          $Res Function(AuthModuleCheckEmail) then) =
      _$AuthModuleCheckEmailCopyWithImpl<$Res, AuthModuleCheckEmail>;
  @useResult
  $Res call({String email});
}

/// @nodoc
class _$AuthModuleCheckEmailCopyWithImpl<$Res,
        $Val extends AuthModuleCheckEmail>
    implements $AuthModuleCheckEmailCopyWith<$Res> {
  _$AuthModuleCheckEmailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? email = null,
  }) {
    return _then(_value.copyWith(
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$AuthModuleCheckEmailImplCopyWith<$Res>
    implements $AuthModuleCheckEmailCopyWith<$Res> {
  factory _$$AuthModuleCheckEmailImplCopyWith(_$AuthModuleCheckEmailImpl value,
          $Res Function(_$AuthModuleCheckEmailImpl) then) =
      __$$AuthModuleCheckEmailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String email});
}

/// @nodoc
class __$$AuthModuleCheckEmailImplCopyWithImpl<$Res>
    extends _$AuthModuleCheckEmailCopyWithImpl<$Res, _$AuthModuleCheckEmailImpl>
    implements _$$AuthModuleCheckEmailImplCopyWith<$Res> {
  __$$AuthModuleCheckEmailImplCopyWithImpl(_$AuthModuleCheckEmailImpl _value,
      $Res Function(_$AuthModuleCheckEmailImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? email = null,
  }) {
    return _then(_$AuthModuleCheckEmailImpl(
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleCheckEmailImpl implements _AuthModuleCheckEmail {
  const _$AuthModuleCheckEmailImpl({required this.email});

  factory _$AuthModuleCheckEmailImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleCheckEmailImplFromJson(json);

  /// The email address to check for availability.
  @override
  final String email;

  @override
  String toString() {
    return 'AuthModuleCheckEmail(email: $email)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleCheckEmailImpl &&
            (identical(other.email, email) || other.email == email));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, email);

  /// Create a copy of AuthModuleCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleCheckEmailImplCopyWith<_$AuthModuleCheckEmailImpl>
      get copyWith =>
          __$$AuthModuleCheckEmailImplCopyWithImpl<_$AuthModuleCheckEmailImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleCheckEmailImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleCheckEmail implements AuthModuleCheckEmail {
  const factory _AuthModuleCheckEmail({required final String email}) =
      _$AuthModuleCheckEmailImpl;

  factory _AuthModuleCheckEmail.fromJson(Map<String, dynamic> json) =
      _$AuthModuleCheckEmailImpl.fromJson;

  /// The email address to check for availability.
  @override
  String get email;

  /// Create a copy of AuthModuleCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleCheckEmailImplCopyWith<_$AuthModuleCheckEmailImpl>
      get copyWith => throw _privateConstructorUsedError;
}
