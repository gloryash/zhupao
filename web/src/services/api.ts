/**
 * Typed cloud-function action wrappers.
 *
 * Every private call automatically attaches the current authToken (set by the
 * session store). Failed responses throw a CloudError carrying the backend
 * `code`, and auth-class codes trigger the registered unauthorized handler so
 * the app can route back to login.
 */
import { callFunction, CloudError } from './cloudbase'
import type {
  Appointment,
  Certificate,
  CloudResponse,
  ExamAnswer,
  ExamQuestion,
  ExamResult,
  FrequentContact,
  Order,
  TrainingStatus,
  User,
  UserStats,
  Volunteer,
  YesNo
} from '../types'

const AUTH_ERROR_CODES = new Set(['SESSION_EXPIRED', 'AUTH_REQUIRED', 'USER_NOT_FOUND'])

let authToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

interface RequestOptions {
  /** Skip attaching the auth token (used for register/login/public actions). */
  anonymous?: boolean
}

async function request(
  fn: string,
  action: string,
  payload: Record<string, unknown> = {},
  opts: RequestOptions = {}
): Promise<CloudResponse> {
  const data: Record<string, unknown> = { action, ...payload }
  if (!opts.anonymous && authToken) data.authToken = authToken

  const res = await callFunction(fn, data)

  if (!res || res.success !== true) {
    const code = (res && res.code) || 'CLOUD_ERROR'
    const message = (res && (res.error as string)) || '操作失败，请稍后再试'
    if (AUTH_ERROR_CODES.has(code) && !opts.anonymous && onUnauthorized) {
      onUnauthorized()
    }
    throw new CloudError(message, code, res || undefined)
  }
  return res
}

/* --------------------------------- auth ----------------------------------- */

export interface RegisterProfile {
  userType: 'disabled' | 'volunteer'
  nickName: string
  name?: string
  emergencyName?: string
  emergencyPhone?: string
  emergencyRelation?: string
  runningLocation?: string
  runningYears?: string
  pace?: string
  hasMarathon?: YesNo
  hasFirstAid?: YesNo
  hasCompanionExp?: YesNo
}

export interface AuthSession {
  authToken: string
  expiresAt: string
  user: User
}

export async function registerAccount(
  identifier: string,
  password: string,
  profile: RegisterProfile
): Promise<AuthSession> {
  const res = await request('webAuth', 'register', { identifier, password, profile }, { anonymous: true })
  return { authToken: res.authToken as string, expiresAt: res.expiresAt as string, user: res.user as User }
}

export async function loginAccount(identifier: string, password: string): Promise<AuthSession> {
  const res = await request('webAuth', 'login', { identifier, password }, { anonymous: true })
  return { authToken: res.authToken as string, expiresAt: res.expiresAt as string, user: res.user as User }
}

export async function fetchMe(token: string): Promise<User> {
  const res = await request('webAuth', 'me', { authToken: token }, { anonymous: true })
  return res.user as User
}

export async function logoutAccount(token: string): Promise<void> {
  await callFunction('webAuth', { action: 'logout', authToken: token })
}

/* --------------------------------- user ----------------------------------- */

export async function getUserProfile(): Promise<User> {
  const res = await request('handleUser', 'getUserProfile')
  return res.user as User
}

export async function getUserStats(): Promise<UserStats> {
  const res = await request('handleUser', 'getUserStats')
  return res.stats as UserStats
}

export async function updateProfile(payload: {
  nickName?: string
  name?: string
  avatarUrl?: string
}): Promise<User> {
  const res = await request('handleUser', 'updateProfile', payload)
  return res.user as User
}

export async function updateEmergencyContact(payload: {
  emergencyName: string
  emergencyPhone: string
  emergencyRelation: string
}): Promise<void> {
  await request('handleUser', 'updateEmergencyContact', payload)
}

export async function updateUserLocation(latitude: number, longitude: number): Promise<void> {
  await request('handleUser', 'updateLocation', { latitude, longitude })
}

/* ------------------------------- training --------------------------------- */

export async function getTrainingStatus(): Promise<TrainingStatus> {
  const res = await request('handleTraining', 'getTrainingStatus')
  return res.status as TrainingStatus
}

export async function markVideoWatched(): Promise<void> {
  await request('handleTraining', 'updateVideoWatched')
}

export async function getExamQuestions(): Promise<{ questions: ExamQuestion[]; passScore: number }> {
  const res = await request('handleTraining', 'getExamQuestions', {}, { anonymous: true })
  return { questions: (res.questions as ExamQuestion[]) || [], passScore: (res.passScore as number) || 80 }
}

export async function submitExam(answers: ExamAnswer[]): Promise<ExamResult> {
  const res = await request('handleTraining', 'submitExam', { answers })
  return res as unknown as ExamResult
}

export async function getCertificate(): Promise<Certificate | null> {
  try {
    const res = await request('handleTraining', 'getCertificate')
    return res.certificate as Certificate
  } catch (err) {
    if (err instanceof CloudError) return null
    throw err
  }
}

export async function verifyCertificate(
  certificateNo: string
): Promise<{ valid: boolean; certificate?: Certificate }> {
  const res = await request('handleTraining', 'verifyCertificate', { certificateNo }, { anonymous: true })
  return { valid: Boolean(res.valid), certificate: res.certificate as Certificate | undefined }
}

/* ------------------------------ volunteers -------------------------------- */

export async function getVolunteers(page = 1, pageSize = 20): Promise<Volunteer[]> {
  const res = await request('handleVolunteer', 'getVolunteers', { page, pageSize }, { anonymous: true })
  return (res.volunteers as Volunteer[]) || []
}

export async function getAvailableVolunteers(
  latitude?: number,
  longitude?: number,
  radius = 50000
): Promise<Volunteer[]> {
  const res = await request('handleVolunteer', 'getAvailableVolunteers', { latitude, longitude, radius })
  return (res.volunteers as Volunteer[]) || []
}

export async function getVolunteerDetail(volunteerId: string): Promise<Volunteer> {
  const res = await request('handleVolunteer', 'getVolunteerDetail', { volunteerId }, { anonymous: true })
  return res.volunteer as Volunteer
}

export async function updateAvailability(
  isAvailable: boolean,
  latitude?: number,
  longitude?: number
): Promise<void> {
  await request('handleVolunteer', 'updateAvailability', { isAvailable, latitude, longitude })
}

export async function getFrequentContacts(limit = 10): Promise<FrequentContact[]> {
  const res = await request('handleVolunteer', 'getFrequentContacts', { limit })
  return (res.contacts as FrequentContact[]) || []
}

/* -------------------------------- orders ---------------------------------- */

export async function publishOrder(payload: {
  targetDistance: string | number
  estimatedDuration: string | number
  latitude: number
  longitude: number
  address: string
}): Promise<Order> {
  const res = await request('handleOrder', 'publish', payload)
  return res.order as Order
}

export async function getWaitingOrders(latitude?: number, longitude?: number): Promise<Order[]> {
  const res = await request('handleOrder', 'getWaitingOrders', { latitude, longitude })
  return (res.orders as Order[]) || []
}

export async function getMyOrders(status?: string): Promise<Order[]> {
  const res = await request('handleOrder', 'getMyOrders', status ? { status } : {})
  return (res.orders as Order[]) || []
}

export async function getOrderDetail(orderId?: string): Promise<Order | null> {
  try {
    const res = await request('handleOrder', 'getOrderDetail', orderId ? { orderId } : {})
    return res.order as Order
  } catch (err) {
    if (err instanceof CloudError && err.code === 'ORDER_NOT_FOUND') return null
    throw err
  }
}

export async function acceptOrder(orderId: string): Promise<Order> {
  const res = await request('handleOrder', 'accept', { orderId })
  return res.order as Order
}

export async function updateOrderStatus(orderId: string, status: 'arrived' | 'running'): Promise<void> {
  await request('handleOrder', 'updateOrderStatus', { orderId, status })
}

export async function updateVolunteerLocation(payload: {
  orderId: string
  latitude: number
  longitude: number
  runningStats?: { distance: number; duration: number; pace: string }
}): Promise<void> {
  await request('handleOrder', 'updateVolunteerLocation', payload)
}

export async function completeOrder(
  orderId: string,
  actualDistance: number,
  duration: number
): Promise<void> {
  await request('handleOrder', 'complete', { orderId, actualDistance, duration })
}

export async function cancelOrder(orderId: string): Promise<void> {
  await request('handleOrder', 'cancel', { orderId })
}

/* ----------------------------- appointments ------------------------------- */

export async function getAppointments(status?: string): Promise<Appointment[]> {
  const res = await request('handleSchedule', 'getAppointments', status ? { status } : {})
  return (res.appointments as Appointment[]) || []
}

export async function createAppointment(payload: {
  volunteerId: string
  appointmentDate: string
  appointmentTime: string
  address?: string
  targetDistance?: string
  estimatedDuration?: string
  note?: string
}): Promise<Appointment> {
  const res = await request('handleSchedule', 'createAppointment', payload)
  return res.appointment as Appointment
}

export async function confirmAppointment(appointmentId: string): Promise<void> {
  await request('handleSchedule', 'confirmAppointment', { appointmentId })
}

export async function completeAppointment(
  appointmentId: string,
  rating?: number,
  comment?: string
): Promise<void> {
  await request('handleSchedule', 'completeAppointment', { appointmentId, rating, comment })
}

export async function cancelAppointment(appointmentId: string): Promise<void> {
  await request('handleSchedule', 'cancelAppointment', { appointmentId })
}

export { CloudError }
