import { speakVoiceCue, speakVoiceCueSequence } from './voiceCue.ts'

export type RunnerOrderVoiceCue = 'publishSuccess' | 'cancelSuccess' | 'accepted'
export type VolunteerOrderVoiceCue =
  | 'acceptSuccess'
  | 'arriveSuccess'
  | 'startRunSuccess'
  | 'locationUploaded'
  | 'completeSuccess'
  | 'cancelSuccess'

export interface OrderVoiceCueOptions {
  phone?: string
}

const RUNNER_ORDER_VOICE_CUES: Record<RunnerOrderVoiceCue, string> = {
  publishSuccess: '已发布陪跑请求，正在为你匹配志愿者',
  cancelSuccess: '已取消该陪跑请求',
  accepted: '您的订单已被接'
}

const VOLUNTEER_ORDER_VOICE_CUES: Record<VolunteerOrderVoiceCue, string> = {
  acceptSuccess: '接单成功，请尽快前往集合点',
  arriveSuccess: '已标记到达集合点',
  startRunSuccess: '陪跑开始，注意安全',
  locationUploaded: '已上传实时定位与配速',
  completeSuccess: '陪跑已完成，感谢你的付出',
  cancelSuccess: '已取消该订单'
}

function phoneForSpeech(phone: string | undefined): string {
  return String(phone || '')
    .replace(/[^\d+]/g, '')
    .split('')
    .join(' ')
}

export function getRunnerOrderVoiceCue(
  cue: RunnerOrderVoiceCue,
  options: OrderVoiceCueOptions = {}
): string {
  const label = RUNNER_ORDER_VOICE_CUES[cue]
  const phone = phoneForSpeech(options.phone)
  if (cue === 'accepted' && phone) return `${label}。志愿者电话：${phone}`
  return label
}

export function getRunnerOrderVoiceCueSequence(
  cue: RunnerOrderVoiceCue,
  options: OrderVoiceCueOptions = {}
): string[] {
  const label = RUNNER_ORDER_VOICE_CUES[cue]
  const phone = phoneForSpeech(options.phone)
  if (cue === 'accepted' && phone) return [label, `志愿者手机号码：${phone}`]
  return [getRunnerOrderVoiceCue(cue, options)]
}

export function getVolunteerOrderVoiceCue(
  cue: VolunteerOrderVoiceCue,
  options: OrderVoiceCueOptions = {}
): string {
  const label = VOLUNTEER_ORDER_VOICE_CUES[cue]
  const phone = phoneForSpeech(options.phone)
  if (cue === 'acceptSuccess' && phone) return `${label}。跑者电话：${phone}`
  return label
}

export function speakRunnerOrderVoiceCue(
  cue: RunnerOrderVoiceCue,
  options: OrderVoiceCueOptions = {}
): void {
  speakVoiceCueSequence(getRunnerOrderVoiceCueSequence(cue, options))
}

export function speakVolunteerOrderVoiceCue(
  cue: VolunteerOrderVoiceCue,
  options: OrderVoiceCueOptions = {}
): void {
  speakVoiceCue(getVolunteerOrderVoiceCue(cue, options))
}
