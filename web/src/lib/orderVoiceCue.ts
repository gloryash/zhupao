import { speakVoiceCue } from './voiceCue.ts'

export type RunnerOrderVoiceCue = 'publishSuccess' | 'cancelSuccess'

const RUNNER_ORDER_VOICE_CUES: Record<RunnerOrderVoiceCue, string> = {
  publishSuccess: '已发布陪跑请求，正在为你匹配志愿者',
  cancelSuccess: '已取消该陪跑请求'
}

export function getRunnerOrderVoiceCue(cue: RunnerOrderVoiceCue): string {
  return RUNNER_ORDER_VOICE_CUES[cue]
}

export function speakRunnerOrderVoiceCue(cue: RunnerOrderVoiceCue): void {
  speakVoiceCue(getRunnerOrderVoiceCue(cue))
}
