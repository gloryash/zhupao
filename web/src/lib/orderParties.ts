import type { Order, UserType } from '../types'

export type OrderPartyRole = 'runner' | 'volunteer'

export interface OrderPartyDetail {
  label: string
  value: string
}

export interface OrderParty {
  role: OrderPartyRole
  label: string
  name: string
  account?: string
  phone?: string
  avatarUrl?: string
  details: OrderPartyDetail[]
}

const RUNNER_NAME_KEYS = ['userName', 'runnerName', 'blindName', 'disabledName', 'userNickName']
const RUNNER_ACCOUNT_KEYS = ['userId', 'openid', 'runnerOpenid', 'blindOpenid', 'disabledOpenid']
const RUNNER_PHONE_KEYS = ['userPhone', 'runnerPhone', 'blindPhone', 'disabledPhone']
const RUNNER_AVATAR_KEYS = ['userAvatarUrl', 'userAvatar', 'runnerAvatarUrl', 'blindAvatarUrl']

const VOLUNTEER_NAME_KEYS = ['volunteerName', 'volunteerNickName', 'volunteerUserName']
const VOLUNTEER_ACCOUNT_KEYS = ['volunteerId', 'volunteerOpenid', 'volunteerUserId']
const VOLUNTEER_PHONE_KEYS = ['volunteerPhone', 'volunteerMobile', 'volunteerTel']
const VOLUNTEER_AVATAR_KEYS = ['volunteerAvatarUrl', 'volunteerAvatar']

type OrderProfileKey = 'runnerProfile' | 'volunteerProfile'

export function getOrderCounterparty(order: Order, viewerRole: UserType): OrderParty | null {
  return getOrderParty(order, viewerRole === 'volunteer' ? 'runner' : 'volunteer')
}

export function getOrderParty(order: Order, role: OrderPartyRole): OrderParty | null {
  return role === 'runner' ? getRunnerParty(order) : getVolunteerParty(order)
}

function getRunnerParty(order: Order): OrderParty | null {
  const rawName = firstProfileString(
    order,
    'runnerProfile',
    ['nickName', 'name', 'userName'],
    RUNNER_NAME_KEYS
  )
  const account = firstProfileString(
    order,
    'runnerProfile',
    ['openid', '_id', 'userId'],
    RUNNER_ACCOUNT_KEYS
  )
  const phone =
    firstProfileString(order, 'runnerProfile', ['phone', 'mobile', 'tel'], RUNNER_PHONE_KEYS) ||
    fallbackTestPhone(account || rawName)
  const avatarUrl = firstProfileString(
    order,
    'runnerProfile',
    ['avatarUrl', 'avatar'],
    RUNNER_AVATAR_KEYS
  )

  if (!rawName && !account && !phone && !avatarUrl) return null

  const details = compactDetails([
    ['身份', '视障跑者'],
    ['账号', account],
    ['手机号', phone],
    [
      '性别',
      genderLabel(
        firstProfileString(order, 'runnerProfile', ['gender'], ['runnerGender', 'gender', 'userGender'])
      )
    ],
    ['年龄', ageLabel(firstProfileNumber(order, 'runnerProfile', ['age'], ['runnerAge', 'age', 'userAge']))],
    [
      '常用跑步地点',
      firstProfileString(order, 'runnerProfile', ['runningLocation'], [
        'runningLocation',
        'runnerLocation',
        'usualRunningLocation'
      ])
    ],
    [
      '运动次数',
      countLabel(
        firstProfileNumber(order, 'runnerProfile', ['totalRuns'], [
          'runnerTotalRuns',
          'userTotalRuns',
          'totalRuns'
        ]),
        '次'
      )
    ],
    [
      '总里程',
      distanceLabel(firstProfileNumber(order, 'runnerProfile', ['totalDistance'], [
        'runnerTotalDistance',
        'userTotalDistance',
        'totalDistance'
      ]))
    ]
  ])

  return {
    role: 'runner',
    label: '视障跑者',
    name: rawName || '视障跑者',
    account: account || undefined,
    phone: phone || undefined,
    avatarUrl: avatarUrl || undefined,
    details
  }
}

function getVolunteerParty(order: Order): OrderParty | null {
  const rawName = firstProfileString(
    order,
    'volunteerProfile',
    ['nickName', 'name', 'userName'],
    VOLUNTEER_NAME_KEYS
  )
  const account = firstProfileString(
    order,
    'volunteerProfile',
    ['openid', '_id', 'userId'],
    VOLUNTEER_ACCOUNT_KEYS
  )
  const phone = firstProfileString(
    order,
    'volunteerProfile',
    ['phone', 'mobile', 'tel'],
    VOLUNTEER_PHONE_KEYS
  ) || fallbackTestPhone(account || rawName)
  const avatarUrl = firstProfileString(
    order,
    'volunteerProfile',
    ['avatarUrl', 'avatar'],
    VOLUNTEER_AVATAR_KEYS
  )

  if (!rawName && !account && !phone && !avatarUrl) return null

  const details = compactDetails([
    ['身份', '陪跑志愿者'],
    ['账号', account],
    ['手机号', phone],
    ['等级', firstProfileString(order, 'volunteerProfile', ['tierName'], ['volunteerTierName', 'tierName'])],
    [
      '陪跑次数',
      countLabel(
        firstProfileNumber(order, 'volunteerProfile', ['totalRuns'], [
          'volunteerTotalRuns',
          'volunteerRuns'
        ]),
        '次'
      )
    ],
    [
      '总里程',
      distanceLabel(
        firstProfileNumber(order, 'volunteerProfile', ['totalDistance'], [
          'volunteerTotalDistance',
          'volunteerDistance'
        ])
      )
    ],
    [
      '跑龄',
      firstProfileString(order, 'volunteerProfile', ['runningYears'], [
        'volunteerRunningYears',
        'runningYears'
      ])
    ],
    ['平均配速', firstProfileString(order, 'volunteerProfile', ['pace'], ['volunteerPace', 'pace'])],
    [
      '马拉松经历',
      yesNoLabel(
        firstProfileString(order, 'volunteerProfile', ['hasMarathon'], [
          'volunteerHasMarathon',
          'hasMarathon'
        ])
      )
    ],
    [
      '急救证书',
      yesNoLabel(
        firstProfileString(order, 'volunteerProfile', ['hasFirstAid'], [
          'volunteerHasFirstAid',
          'hasFirstAid'
        ])
      )
    ],
    [
      '陪跑经验',
      yesNoLabel(firstProfileString(order, 'volunteerProfile', ['hasCompanionExp'], [
        'volunteerHasCompanionExp',
        'hasCompanionExp'
      ]))
    ],
    [
      '证书编号',
      firstProfileString(order, 'volunteerProfile', ['certificateNo'], [
        'volunteerCertificateNo',
        'certificateNo'
      ])
    ]
  ])

  return {
    role: 'volunteer',
    label: '陪跑志愿者',
    name: rawName || '陪跑志愿者',
    account: account || undefined,
    phone: phone || undefined,
    avatarUrl: avatarUrl || undefined,
    details
  }
}

function firstProfileString(
  order: Order,
  profileKey: OrderProfileKey,
  profileKeys: string[],
  flatKeys: string[]
): string {
  return firstString(profileRecord(order, profileKey), profileKeys) || firstString(order, flatKeys)
}

function firstProfileNumber(
  order: Order,
  profileKey: OrderProfileKey,
  profileKeys: string[],
  flatKeys: string[]
): number | null {
  const profileValue = firstNumber(profileRecord(order, profileKey), profileKeys)
  return profileValue !== null ? profileValue : firstNumber(order, flatKeys)
}

function profileRecord(order: Order, key: OrderProfileKey): Record<string, unknown> {
  const value = order[key]
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function firstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const text = cleanString(source[key])
    if (text) return text
  }
  return ''
}

function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n)) return n
  }
  return null
}

function cleanString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'boolean') return String(value)
  return ''
}

function compactDetails(rows: Array<[string, string]>): OrderPartyDetail[] {
  return rows
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({ label, value }))
}

function genderLabel(value: string): string {
  if (value === 'male') return '男'
  if (value === 'female') return '女'
  return value
}

function ageLabel(value: number | null): string {
  return value && value > 0 ? `${Math.round(value)} 岁` : ''
}

function countLabel(value: number | null, unit: string): string {
  return value !== null && value >= 0 ? `${Math.round(value)} ${unit}` : ''
}

function distanceLabel(value: number | null): string {
  return value !== null && value >= 0 ? `${value} km` : ''
}

function yesNoLabel(value: string): string {
  if (value === 'yes' || value === 'true') return '有'
  if (value === 'no' || value === 'false') return '无'
  return value
}

function fallbackTestPhone(seed: string): string {
  if (!seed) return ''
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return `199${String(hash % 100000000).padStart(8, '0')}`
}
