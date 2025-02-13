// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_req_check_email.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthReqCheckEmail _$AuthReqCheckEmailFromJson(Map<String, dynamic> json) {
  return _AuthReqCheckEmail.fromJson(json);
}

/// @nodoc
mixin _$AuthReqCheckEmail {
  AuthCheckEmail get data => throw _privateConstructorUsedError;

  /// Serializes this AuthReqCheckEmail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthReqCheckEmailCopyWith<AuthReqCheckEmail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthReqCheckEmailCopyWith<$Res> {
  factory $AuthReqCheckEmailCopyWith(
          AuthReqCheckEmail value, $Res Function(AuthReqCheckEmail) then) =
      _$AuthReqCheckEmailCopyWithImpl<$Res, AuthReqCheckEmail>;
  @useResult
  $Res call({AuthCheckEmail data});

  $AuthCheckEmailCopyWith<$Res> get data;
}

/// @nodoc
class _$AuthReqCheckEmailCopyWithImpl<$Res, $Val extends AuthReqCheckEmail>
    implements $AuthReqCheckEmailCopyWith<$Res> {
  _$AuthReqCheckEmailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthReqCheckEmail
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
              as AuthCheckEmail,
    ) as $Val);
  }

  /// Create a copy of AuthReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthCheckEmailCopyWith<$Res> get data {
    return $AuthCheckEmailCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthReqCheckEmailImplCopyWith<$Res>
    implements $AuthReqCheckEmailCopyWith<$Res> {
  factory _$$AuthReqCheckEmailImplCopyWith(_$AuthReqCheckEmailImpl value,
          $Res Function(_$AuthReqCheckEmailImpl) then) =
      __$$AuthReqCheckEmailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthCheckEmail data});

  @override
  $AuthCheckEmailCopyWith<$Res> get data;
}

/// @nodoc
class __$$AuthReqCheckEmailImplCopyWithImpl<$Res>
    extends _$AuthReqCheckEmailCopyWithImpl<$Res, _$AuthReqCheckEmailImpl>
    implements _$$AuthReqCheckEmailImplCopyWith<$Res> {
  __$$AuthReqCheckEmailImplCopyWithImpl(_$AuthReqCheckEmailImpl _value,
      $Res Function(_$AuthReqCheckEmailImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$AuthReqCheckEmailImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthCheckEmail,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthReqCheckEmailImpl implements _AuthReqCheckEmail {
  const _$AuthReqCheckEmailImpl({required this.data});

  factory _$AuthReqCheckEmailImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthReqCheckEmailImplFromJson(json);

  @override
  final AuthCheckEmail data;

  @override
  String toString() {
    return 'AuthReqCheckEmail(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthReqCheckEmailImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of AuthReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthReqCheckEmailImplCopyWith<_$AuthReqCheckEmailImpl> get copyWith =>
      __$$AuthReqCheckEmailImplCopyWithImpl<_$AuthReqCheckEmailImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthReqCheckEmailImplToJson(
      this,
    );
  }
}

abstract class _AuthReqCheckEmail implements AuthReqCheckEmail {
  const factory _AuthReqCheckEmail({required final AuthCheckEmail data}) =
      _$AuthReqCheckEmailImpl;

  factory _AuthReqCheckEmail.fromJson(Map<String, dynamic> json) =
      _$AuthReqCheckEmailImpl.fromJson;

  @override
  AuthCheckEmail get data;

  /// Create a copy of AuthReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthReqCheckEmailImplCopyWith<_$AuthReqCheckEmailImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
