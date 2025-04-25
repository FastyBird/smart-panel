// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'auth_module_req_check_email.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

AuthModuleReqCheckEmail _$AuthModuleReqCheckEmailFromJson(
    Map<String, dynamic> json) {
  return _AuthModuleReqCheckEmail.fromJson(json);
}

/// @nodoc
mixin _$AuthModuleReqCheckEmail {
  AuthModuleCheckEmail get data => throw _privateConstructorUsedError;

  /// Serializes this AuthModuleReqCheckEmail to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of AuthModuleReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $AuthModuleReqCheckEmailCopyWith<AuthModuleReqCheckEmail> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $AuthModuleReqCheckEmailCopyWith<$Res> {
  factory $AuthModuleReqCheckEmailCopyWith(AuthModuleReqCheckEmail value,
          $Res Function(AuthModuleReqCheckEmail) then) =
      _$AuthModuleReqCheckEmailCopyWithImpl<$Res, AuthModuleReqCheckEmail>;
  @useResult
  $Res call({AuthModuleCheckEmail data});

  $AuthModuleCheckEmailCopyWith<$Res> get data;
}

/// @nodoc
class _$AuthModuleReqCheckEmailCopyWithImpl<$Res,
        $Val extends AuthModuleReqCheckEmail>
    implements $AuthModuleReqCheckEmailCopyWith<$Res> {
  _$AuthModuleReqCheckEmailCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of AuthModuleReqCheckEmail
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
              as AuthModuleCheckEmail,
    ) as $Val);
  }

  /// Create a copy of AuthModuleReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $AuthModuleCheckEmailCopyWith<$Res> get data {
    return $AuthModuleCheckEmailCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$AuthModuleReqCheckEmailImplCopyWith<$Res>
    implements $AuthModuleReqCheckEmailCopyWith<$Res> {
  factory _$$AuthModuleReqCheckEmailImplCopyWith(
          _$AuthModuleReqCheckEmailImpl value,
          $Res Function(_$AuthModuleReqCheckEmailImpl) then) =
      __$$AuthModuleReqCheckEmailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({AuthModuleCheckEmail data});

  @override
  $AuthModuleCheckEmailCopyWith<$Res> get data;
}

/// @nodoc
class __$$AuthModuleReqCheckEmailImplCopyWithImpl<$Res>
    extends _$AuthModuleReqCheckEmailCopyWithImpl<$Res,
        _$AuthModuleReqCheckEmailImpl>
    implements _$$AuthModuleReqCheckEmailImplCopyWith<$Res> {
  __$$AuthModuleReqCheckEmailImplCopyWithImpl(
      _$AuthModuleReqCheckEmailImpl _value,
      $Res Function(_$AuthModuleReqCheckEmailImpl) _then)
      : super(_value, _then);

  /// Create a copy of AuthModuleReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$AuthModuleReqCheckEmailImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as AuthModuleCheckEmail,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$AuthModuleReqCheckEmailImpl implements _AuthModuleReqCheckEmail {
  const _$AuthModuleReqCheckEmailImpl({required this.data});

  factory _$AuthModuleReqCheckEmailImpl.fromJson(Map<String, dynamic> json) =>
      _$$AuthModuleReqCheckEmailImplFromJson(json);

  @override
  final AuthModuleCheckEmail data;

  @override
  String toString() {
    return 'AuthModuleReqCheckEmail(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$AuthModuleReqCheckEmailImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of AuthModuleReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$AuthModuleReqCheckEmailImplCopyWith<_$AuthModuleReqCheckEmailImpl>
      get copyWith => __$$AuthModuleReqCheckEmailImplCopyWithImpl<
          _$AuthModuleReqCheckEmailImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$AuthModuleReqCheckEmailImplToJson(
      this,
    );
  }
}

abstract class _AuthModuleReqCheckEmail implements AuthModuleReqCheckEmail {
  const factory _AuthModuleReqCheckEmail(
          {required final AuthModuleCheckEmail data}) =
      _$AuthModuleReqCheckEmailImpl;

  factory _AuthModuleReqCheckEmail.fromJson(Map<String, dynamic> json) =
      _$AuthModuleReqCheckEmailImpl.fromJson;

  @override
  AuthModuleCheckEmail get data;

  /// Create a copy of AuthModuleReqCheckEmail
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$AuthModuleReqCheckEmailImplCopyWith<_$AuthModuleReqCheckEmailImpl>
      get copyWith => throw _privateConstructorUsedError;
}
