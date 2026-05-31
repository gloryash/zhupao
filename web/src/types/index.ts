export type UserType = 'disabled' | 'volunteer'
export type YesNo = 'yes' | 'no'

/** Shape returned by webAuth / handleUser `publicUser`. Backend is loosely
 *  typed, so unknown extra keys are tolerated via the index signature. */
export interface User {
  _id: string
  openid: string
  userType: UserType
  role?: string
  nickName: string
  name?: string
  avatarUrl?: string
  phone?: string
  email?: string
  gender?: string
  resume?: string

  points?: number
  exp?: number
  checkInDays?: number
  lastCheckInDate?: string
  tierLevel?: number
  tierName?: string
  totalRuns?: number
  totalDistance?: number
  totalTime?: number
  likes?: number
  medals?: number

  emergencyName?: string
  emergencyPhone?: string
  emergencyRelation?: string
  runningLocation?: string

  examPassed?: boolean | null
  examScore?: number
  examDate?: string
  certificateNo?: string
  videoWatched?: boolean
  isAvailable?: boolean

  runningYears?: string
  pace?: string
  hasMarathon?: YesNo
  hasFirstAid?: YesNo
  hasCompanionExp?: YesNo

  latitude?: number
  longitude?: number

  createdAt?: string
  [key: string]: unknown
}

export interface UserStats {
  points: number
  exp: number
  totalRuns: number
  totalDistance: number
  totalTime: number
  tierLevel: number
  tierName: string
  likes: number
  medals: number
  checkInDays: number
  lastCheckInDate: string
  completedOrders: number
  examPassed: boolean
  videoWatched: boolean
}

export interface TrainingStatus {
  videoWatched: boolean
  examPassed: boolean
  examScore: number
  examDate: string
  certificateNo: string
}

export interface ExamQuestion {
  _id: string
  question: string
  options: string[]
  order: number
}

export interface ExamAnswer {
  questionId: string
  selectedIndex: number
}

export interface ExamResult {
  passed: boolean
  score: number
  correctCount: number
  totalQuestions: number
  results: { questionId: string; isCorrect: boolean }[]
  certificateNo: string
  examDate: string
}

export interface Certificate {
  userName: string
  certificateNo: string
  score: number
  examDate: string
  userType?: UserType
  status?: string
}

export type OrderStatus =
  | 'waiting'
  | 'accepted'
  | 'arrived'
  | 'running'
  | 'completed'
  | 'cancelled'

export interface Order {
  _id: string
  openid?: string
  userName?: string
  userId?: string
  targetDistance: string | number
  estimatedDuration: string | number
  latitude?: number
  longitude?: number
  address?: string
  volunteerOpenid?: string
  volunteerName?: string
  volunteerId?: string
  status: OrderStatus
  publishTime?: string
  acceptTime?: string
  startTime?: string
  endTime?: string
  volunteerLat?: number
  volunteerLng?: number
  actualDistance?: string | number
  duration?: number
  rating?: number
  comment?: string
  distance?: number
  runningStats?: RunningStats
  [key: string]: unknown
}

export interface RunningStats {
  distance: number
  duration: number
  pace: string
}

export interface Volunteer {
  _id: string
  nickName: string
  avatarUrl?: string
  tierLevel?: number
  tierName?: string
  totalRuns?: number
  totalDistance?: number
  likes?: number
  isAvailable?: boolean
  runningYears?: string
  pace?: string
  hasMarathon?: YesNo
  hasFirstAid?: YesNo
  hasCompanionExp?: YesNo
  latitude?: number
  longitude?: number
  distance?: number
}

export type AppointmentStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export interface Appointment {
  _id: string
  blindOpenid?: string
  blindName?: string
  volunteerOpenid?: string
  volunteerName?: string
  volunteerAvatar?: string
  appointmentDate: string
  appointmentTime: string
  address?: string
  targetDistance?: string
  estimatedDuration?: string
  note?: string
  status: AppointmentStatus
  rating?: number
  comment?: string
  [key: string]: unknown
}

export interface FrequentContact {
  openid: string
  name?: string
  nickName?: string
  avatarUrl?: string
  count: number
  tierName?: string
  totalRuns?: number
}

/** Every cloud function returns at least { success } plus action-specific keys. */
export interface CloudResponse {
  success: boolean
  code?: string
  error?: string
  [key: string]: unknown
}
