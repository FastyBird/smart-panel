// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_check_email.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthCheckEmail _$AuthCheckEmailFromJson(Map<String, dynamic> json) {
  return _AuthCheckEmail.fromJson(json);
}

/// @nodoc
mixin _$AuthCheckEmail {
  /// The email address to check for availability.
  String get email => throw _privateConstructorUsedError;

  /// Serializes this AuthCheckEmail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthCheckEmailCopyWith<AuthCheckEmail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthCheckEmailCopyWith<$Res> {
  factory $AuthCheckEmailCopyWith(
          AuthCheckEmail value, $Res Function(AuthCheckEmail) then) =
      _$AuthCheckEmailCopyWithImpl<$Res, AuthCheckEmail>;
  @useResult
  $Res call({String email});
}

/// @nodoc
class _$AuthCheckEmailCopyWithImpl<$Res, $Val extends AuthCheckEmail>
    implements $AuthCheckEmailCopyWith<$Res> {
  _$AuthCheckEmailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthCheckEmail
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
abstract class _$$AuthCheckEmailImplCopyWith<$Res>
    implements $AuthCheckEmailCopyWith<$Res> {
  factory _$$AuthCheckEmailImplCopyWith(_$AuthCheckEmailImpl value,
          $Res Function(_$AuthCheckEmailImpl) then) =
      __$$AuthCheckEmailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String email});
}

/// @nodoc
class __$$AuthCheckEmailImplCopyWithImpl<$Res>
    extends _$AuthCheckEmailCopyWithImpl<$Res, _$AuthCheckEmailImpl>
    implements _$$AuthCheckEmailImplCopyWith<$Res> {
  __$$AuthCheckEmailImplCopyWithImpl(
      _$AuthCheckEmailImpl _value, $Res Function(_$AuthCheckEmailImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? email = null,
  }) {
    return _then(_$AuthCheckEmailImpl(
      email: null == email
          ? _value.email
          : email // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthCheckEmailImpl implements _AuthCheckEmail {
  const _$AuthCheckEmailImpl({required this.email});

  factory _$AuthCheckEmailImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthCheckEmailImplFromJson(json);

  /// The email address to check for availability.
  @override
  final String email;

  @override
  String toString() {
    return 'AuthCheckEmail(email: $email)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthCheckEmailImpl &&
            (identical(other.email, email) || other.email == email));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, email);

  /// Create a copy of AuthCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthCheckEmailImplCopyWith<_$AuthCheckEmailImpl> get copyWith =>
      __$$AuthCheckEmailImplCopyWithImpl<_$AuthCheckEmailImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthCheckEmailImplToJson(
      this,
    );
  }
}

abstract class _AuthCheckEmail implements AuthCheckEmail {
  const factory _AuthCheckEmail({required final String email}) =
      _$AuthCheckEmailImpl;

  factory _AuthCheckEmail.fromJson(Map<String, dynamic> json) =
      _$AuthCheckEmailImpl.fromJson;

  /// The email address to check for availability.
  @override
  String get email;

  /// Create a copy of AuthCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthCheckEmailImplCopyWith<_$AuthCheckEmailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
