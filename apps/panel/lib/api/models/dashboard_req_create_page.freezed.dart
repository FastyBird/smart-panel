// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_create_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqCreatePage _$DashboardReqCreatePageFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqCreatePage.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqCreatePage {
  DashboardReqCreatePageDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqCreatePage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqCreatePageCopyWith<DashboardReqCreatePage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqCreatePageCopyWith<$Res> {
  factory $DashboardReqCreatePageCopyWith(DashboardReqCreatePage value,
          $Res Function(DashboardReqCreatePage) then) =
      _$DashboardReqCreatePageCopyWithImpl<$Res, DashboardReqCreatePage>;
  @useResult
  $Res call({DashboardReqCreatePageDataUnion data});

  $DashboardReqCreatePageDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqCreatePageCopyWithImpl<$Res,
        $Val extends DashboardReqCreatePage>
    implements $DashboardReqCreatePageCopyWith<$Res> {
  _$DashboardReqCreatePageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqCreatePage
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
              as DashboardReqCreatePageDataUnion,
    ) as $Val);
  }

  /// Create a copy of DashboardReqCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardReqCreatePageDataUnionCopyWith<$Res> get data {
    return $DashboardReqCreatePageDataUnionCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqCreatePageImplCopyWith<$Res>
    implements $DashboardReqCreatePageCopyWith<$Res> {
  factory _$$DashboardReqCreatePageImplCopyWith(
          _$DashboardReqCreatePageImpl value,
          $Res Function(_$DashboardReqCreatePageImpl) then) =
      __$$DashboardReqCreatePageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardReqCreatePageDataUnion data});

  @override
  $DashboardReqCreatePageDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqCreatePageImplCopyWithImpl<$Res>
    extends _$DashboardReqCreatePageCopyWithImpl<$Res,
        _$DashboardReqCreatePageImpl>
    implements _$$DashboardReqCreatePageImplCopyWith<$Res> {
  __$$DashboardReqCreatePageImplCopyWithImpl(
      _$DashboardReqCreatePageImpl _value,
      $Res Function(_$DashboardReqCreatePageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqCreatePageImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardReqCreatePageDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqCreatePageImpl implements _DashboardReqCreatePage {
  const _$DashboardReqCreatePageImpl({required this.data});

  factory _$DashboardReqCreatePageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardReqCreatePageImplFromJson(json);

  @override
  final DashboardReqCreatePageDataUnion data;

  @override
  String toString() {
    return 'DashboardReqCreatePage(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqCreatePageImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqCreatePageImplCopyWith<_$DashboardReqCreatePageImpl>
      get copyWith => __$$DashboardReqCreatePageImplCopyWithImpl<
          _$DashboardReqCreatePageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqCreatePageImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqCreatePage implements DashboardReqCreatePage {
  const factory _DashboardReqCreatePage(
          {required final DashboardReqCreatePageDataUnion data}) =
      _$DashboardReqCreatePageImpl;

  factory _DashboardReqCreatePage.fromJson(Map<String, dynamic> json) =
      _$DashboardReqCreatePageImpl.fromJson;

  @override
  DashboardReqCreatePageDataUnion get data;

  /// Create a copy of DashboardReqCreatePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqCreatePageImplCopyWith<_$DashboardReqCreatePageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
