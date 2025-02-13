// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_update_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqUpdatePage _$DashboardReqUpdatePageFromJson(
    Map<String, dynamic> json) {
  return _DashboardReqUpdatePage.fromJson(json);
}

/// @nodoc
mixin _$DashboardReqUpdatePage {
  DashboardReqUpdatePageDataUnion get data =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqUpdatePage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqUpdatePageCopyWith<DashboardReqUpdatePage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqUpdatePageCopyWith<$Res> {
  factory $DashboardReqUpdatePageCopyWith(DashboardReqUpdatePage value,
          $Res Function(DashboardReqUpdatePage) then) =
      _$DashboardReqUpdatePageCopyWithImpl<$Res, DashboardReqUpdatePage>;
  @useResult
  $Res call({DashboardReqUpdatePageDataUnion data});

  $DashboardReqUpdatePageDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class _$DashboardReqUpdatePageCopyWithImpl<$Res,
        $Val extends DashboardReqUpdatePage>
    implements $DashboardReqUpdatePageCopyWith<$Res> {
  _$DashboardReqUpdatePageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqUpdatePage
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
              as DashboardReqUpdatePageDataUnion,
    ) as $Val);
  }

  /// Create a copy of DashboardReqUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @pragma('vm:prefer-inline')
  $DashboardReqUpdatePageDataUnionCopyWith<$Res> get data {
    return $DashboardReqUpdatePageDataUnionCopyWith<$Res>(_value.data, (value) {
      return _then(_value.copyWith(data: value) as $Val);
    });
  }
}

/// @nodoc
abstract class _$$DashboardReqUpdatePageImplCopyWith<$Res>
    implements $DashboardReqUpdatePageCopyWith<$Res> {
  factory _$$DashboardReqUpdatePageImplCopyWith(
          _$DashboardReqUpdatePageImpl value,
          $Res Function(_$DashboardReqUpdatePageImpl) then) =
      __$$DashboardReqUpdatePageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({DashboardReqUpdatePageDataUnion data});

  @override
  $DashboardReqUpdatePageDataUnionCopyWith<$Res> get data;
}

/// @nodoc
class __$$DashboardReqUpdatePageImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageCopyWithImpl<$Res,
        _$DashboardReqUpdatePageImpl>
    implements _$$DashboardReqUpdatePageImplCopyWith<$Res> {
  __$$DashboardReqUpdatePageImplCopyWithImpl(
      _$DashboardReqUpdatePageImpl _value,
      $Res Function(_$DashboardReqUpdatePageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? data = null,
  }) {
    return _then(_$DashboardReqUpdatePageImpl(
      data: null == data
          ? _value.data
          : data // ignore: cast_nullable_to_non_nullable
              as DashboardReqUpdatePageDataUnion,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdatePageImpl implements _DashboardReqUpdatePage {
  const _$DashboardReqUpdatePageImpl({required this.data});

  factory _$DashboardReqUpdatePageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardReqUpdatePageImplFromJson(json);

  @override
  final DashboardReqUpdatePageDataUnion data;

  @override
  String toString() {
    return 'DashboardReqUpdatePage(data: $data)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdatePageImpl &&
            (identical(other.data, data) || other.data == data));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, data);

  /// Create a copy of DashboardReqUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdatePageImplCopyWith<_$DashboardReqUpdatePageImpl>
      get copyWith => __$$DashboardReqUpdatePageImplCopyWithImpl<
          _$DashboardReqUpdatePageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdatePageImplToJson(
      this,
    );
  }
}

abstract class _DashboardReqUpdatePage implements DashboardReqUpdatePage {
  const factory _DashboardReqUpdatePage(
          {required final DashboardReqUpdatePageDataUnion data}) =
      _$DashboardReqUpdatePageImpl;

  factory _DashboardReqUpdatePage.fromJson(Map<String, dynamic> json) =
      _$DashboardReqUpdatePageImpl.fromJson;

  @override
  DashboardReqUpdatePageDataUnion get data;

  /// Create a copy of DashboardReqUpdatePage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdatePageImplCopyWith<_$DashboardReqUpdatePageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
