// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_tiles_page.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdateTilesPage _$DashboardUpdateTilesPageFromJson(
    Map<String, dynamic> json) {
  return _DashboardUpdateTilesPage.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdateTilesPage {
  /// The title of the page.
  String get title => throw _privateConstructorUsedError;

  /// The display order of the page.
  int get order => throw _privateConstructorUsedError;

  /// Indicates that this is a tiles dashboard page.
  String get type => throw _privateConstructorUsedError;

  /// The icon associated with the page.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdateTilesPage to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdateTilesPageCopyWith<DashboardUpdateTilesPage> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdateTilesPageCopyWith<$Res> {
  factory $DashboardUpdateTilesPageCopyWith(DashboardUpdateTilesPage value,
          $Res Function(DashboardUpdateTilesPage) then) =
      _$DashboardUpdateTilesPageCopyWithImpl<$Res, DashboardUpdateTilesPage>;
  @useResult
  $Res call({String title, int order, String type, String? icon});
}

/// @nodoc
class _$DashboardUpdateTilesPageCopyWithImpl<$Res,
        $Val extends DashboardUpdateTilesPage>
    implements $DashboardUpdateTilesPageCopyWith<$Res> {
  _$DashboardUpdateTilesPageCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardUpdateTilesPageImplCopyWith<$Res>
    implements $DashboardUpdateTilesPageCopyWith<$Res> {
  factory _$$DashboardUpdateTilesPageImplCopyWith(
          _$DashboardUpdateTilesPageImpl value,
          $Res Function(_$DashboardUpdateTilesPageImpl) then) =
      __$$DashboardUpdateTilesPageImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, int order, String type, String? icon});
}

/// @nodoc
class __$$DashboardUpdateTilesPageImplCopyWithImpl<$Res>
    extends _$DashboardUpdateTilesPageCopyWithImpl<$Res,
        _$DashboardUpdateTilesPageImpl>
    implements _$$DashboardUpdateTilesPageImplCopyWith<$Res> {
  __$$DashboardUpdateTilesPageImplCopyWithImpl(
      _$DashboardUpdateTilesPageImpl _value,
      $Res Function(_$DashboardUpdateTilesPageImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? type = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardUpdateTilesPageImpl(
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardUpdateTilesPageImpl implements _DashboardUpdateTilesPage {
  const _$DashboardUpdateTilesPageImpl(
      {required this.title,
      required this.order,
      this.type = 'tiles',
      this.icon});

  factory _$DashboardUpdateTilesPageImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateTilesPageImplFromJson(json);

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// Indicates that this is a tiles dashboard page.
  @override
  @JsonKey()
  final String type;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardUpdateTilesPage(title: $title, order: $order, type: $type, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateTilesPageImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, title, order, type, icon);

  /// Create a copy of DashboardUpdateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateTilesPageImplCopyWith<_$DashboardUpdateTilesPageImpl>
      get copyWith => __$$DashboardUpdateTilesPageImplCopyWithImpl<
          _$DashboardUpdateTilesPageImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateTilesPageImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdateTilesPage implements DashboardUpdateTilesPage {
  const factory _DashboardUpdateTilesPage(
      {required final String title,
      required final int order,
      final String type,
      final String? icon}) = _$DashboardUpdateTilesPageImpl;

  factory _DashboardUpdateTilesPage.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateTilesPageImpl.fromJson;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// Indicates that this is a tiles dashboard page.
  @override
  String get type;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardUpdateTilesPage
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateTilesPageImplCopyWith<_$DashboardUpdateTilesPageImpl>
      get copyWith => throw _privateConstructorUsedError;
}
