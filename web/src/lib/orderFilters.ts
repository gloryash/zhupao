/**
 * Shared option sets for the order publish + waiting-board flows. Values match
 * what handleOrder stores/filters on (`runTimeWindow`, `runnerGender` =
 * male/female, `distanceBasis` = origin/runner, ageRange "min-max"); labels are
 * the Chinese strings shown in the phone UI.
 */

export interface Option {
  value: string
  label: string
}

/** Estimated run duration choices, in minutes. */
export const DURATIONS: number[] = [30, 45, 60, 90]

/** When the runner wants to set off. `immediate` is the default. */
export const TIME_WINDOWS: Option[] = [
  { value: 'immediate', label: '立即出发' },
  { value: 'morning', label: '上午' },
  { value: 'afternoon', label: '下午' },
  { value: 'evening', label: '晚上' }
]

/** Same set, prefixed with an "all" entry for the volunteer filter. */
export const TIME_WINDOW_FILTERS: Option[] = [{ value: 'all', label: '全部时段' }, ...TIME_WINDOWS]

/** Which point the 5km radius is measured from. */
export const DISTANCE_BASES: Option[] = [
  { value: 'origin', label: '起点地址' },
  { value: 'runner', label: '跑者位置' }
]

export const GENDER_FILTERS: Option[] = [
  { value: 'all', label: '性别不限' },
  { value: 'male', label: '男生' },
  { value: 'female', label: '女生' }
]

export const AGE_FILTERS: Option[] = [
  { value: 'all', label: '年龄不限' },
  { value: '18-30', label: '18–30 岁' },
  { value: '31-45', label: '31–45 岁' },
  { value: '46-60', label: '46–60 岁' },
  { value: '60-120', label: '60 岁以上' }
]

export const CITY_FILTERS: Option[] = [
  { value: 'all', label: '全部城市' },
  { value: '上海', label: '上海' },
  { value: '北京', label: '北京' },
  { value: '广州', label: '广州' },
  { value: '深圳', label: '深圳' },
  { value: '杭州', label: '杭州' },
  { value: '成都', label: '成都' }
]

/** Preset prefecture cities offered when the volunteer filters by a specific
 *  city (excludes the "all" sentinel — that is the segmented control's job). */
export const CITY_PRESETS: Option[] = CITY_FILTERS.filter((c) => c.value !== 'all')

/** How the volunteer scopes departure time on the waiting board. */
export type DepartureFilterType = 'all' | 'immediate' | 'within' | 'hour' | 'date'

export const DEPARTURE_FILTER_TYPES: Option[] = [
  { value: 'all', label: '不限' },
  { value: 'immediate', label: '立即出发' },
  { value: 'within', label: '即将出发' },
  { value: 'hour', label: '按整点' },
  { value: 'date', label: '按日期' }
]

/** Time horizons for the "即将出发" (within) departure filter, in minutes. */
export const WITHIN_MINUTES_OPTIONS: Option[] = [
  { value: '15', label: '15 分钟内' },
  { value: '30', label: '30 分钟内' },
  { value: '60', label: '1 小时内' },
  { value: '120', label: '2 小时内' }
]

/** How the volunteer scopes city on the waiting board. */
export type CityMode = 'all' | 'current' | 'custom'

export const CITY_MODES: Option[] = [
  { value: 'all', label: '全部城市' },
  { value: 'current', label: '当前城市' },
  { value: 'custom', label: '指定城市' }
]

export function labelFor(options: Option[], value: string | undefined): string {
  return options.find((o) => o.value === value)?.label ?? ''
}

/** Human label for a stored time-window code (falls back to "立即出发"). */
export function timeWindowLabel(value: string | undefined): string {
  return labelFor(TIME_WINDOWS, value || 'immediate') || '立即出发'
}

/** Human label for a stored gender code; empty string when unknown/unset. */
export function genderLabel(value: string | undefined): string {
  if (value === 'male') return '男'
  if (value === 'female') return '女'
  return ''
}
