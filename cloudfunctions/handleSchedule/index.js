// 云函数：日程相关操作
// 功能：预约管理（创建、获取、取消、完成预约）

const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const { resolveIdentity, requireUser } = require('./shared/auth')
const { fail } = require('./shared/responses')

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  event = event || {}
  const action = event.action

  try {
    const identity = await resolveIdentity(db, event)
    const userError = requireUser(identity)
    if (userError) return userError

    const params = {
      identity,
      openid: identity.openid,
      user: identity.user,
      event
    }

    switch (action) {
      case 'getAppointments':
        return await getAppointments(params)
      case 'createAppointment':
        return await createAppointment(params)
      case 'cancelAppointment':
        return await cancelAppointment(params)
      case 'completeAppointment':
        return await completeAppointment(params)
      case 'confirmAppointment':
        return await confirmAppointment(params)
      case 'getAppointmentsByDate':
        return await getAppointmentsByDate(params)
      default:
        return fail('VALIDATION_ERROR', '未知操作')
    }
  } catch (err) {
    console.error('handleSchedule error:', err)
    return fail('INTERNAL_ERROR', err.message)
  }
}

// 获取用户所有预约
async function getAppointments({ openid, event }) {
  const { status, page = 1, pageSize = 20 } = event

  // 基础条件：当前用户是盲人或志愿者
  let baseCondition = _.or([
    { blindOpenid: openid },
    { volunteerOpenid: openid }
  ])

  let whereCondition = baseCondition
  if (status && status !== 'all') {
    // 同时满足 or 条件和 status 条件
    whereCondition = _.and([
      baseCondition,
      { status: status }
    ])
  }

  const countRes = await db.collection('appointments')
    .where(whereCondition)
    .count()

  const res = await db.collection('appointments')
    .where(whereCondition)
    .orderBy('appointmentDate', 'asc')
    .orderBy('appointmentTime', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    appointments: res.data,
    total: countRes.total,
    page: page,
    pageSize: pageSize
  }
}

// 创建预约
async function createAppointment({ openid, user, event }) {
  const {
    volunteerOpenid, volunteerId, volunteerName, volunteerAvatar,
    appointmentDate, appointmentTime, location, address,
    targetDistance, estimatedDuration, note
  } = event

  if (!hasValue(appointmentDate) || !hasValue(appointmentTime)) {
    return fail('VALIDATION_ERROR', '请填写预约日期和时间')
  }

  if (user.userType !== 'disabled') {
    return fail('FORBIDDEN', '只有视障用户可以创建预约')
  }

  if (!hasValue(volunteerOpenid) && !hasValue(volunteerId)) {
    return fail('VALIDATION_ERROR', '请选择志愿者')
  }

  const volunteerRes = await resolveVolunteer({ volunteerOpenid, volunteerId })
  if (volunteerRes.error) return volunteerRes.error
  const volunteerUser = volunteerRes.user

  if (!volunteerUser.videoWatched || !volunteerUser.examPassed || !hasValue(volunteerUser.certificateNo)) {
    return fail('TRAINING_REQUIRED', '请先完成培训、考试并获得证书')
  }

  if (typeof db.runTransaction !== 'function') {
    return fail('VALIDATION_ERROR', '当前云开发环境不支持事务，无法安全创建预约')
  }

  const appointment = {
    blindOpenid: openid,
    blindUserId: user._id,
    blindName: user.nickName || user.name || '',
    volunteerOpenid: volunteerUser.openid,
    volunteerUserId: volunteerUser._id,
    volunteerName: volunteerUser.nickName || volunteerUser.name || volunteerName || '',
    volunteerAvatar: volunteerUser.avatarUrl || volunteerAvatar || '',
    appointmentDate: appointmentDate,
    appointmentTime: appointmentTime,
    location: location || {},
    address: address || '',
    targetDistance: targetDistance || '',
    estimatedDuration: estimatedDuration || '',
    note: note || '',
    status: 'pending',
    slotLockIds: [
      appointmentLockId(openid, appointmentDate, appointmentTime),
      appointmentLockId(volunteerUser.openid, appointmentDate, appointmentTime)
    ],
    createdBy: openid,
    createdByUserId: user._id,
    createdAt: db.serverDate()
  }

  return await db.runTransaction(async transaction => {
    for (const lockId of appointment.slotLockIds) {
      const lock = await getTransactionDoc(transaction, 'appointment_locks', lockId)
      if (lock && ['pending', 'confirmed'].includes(lock.status)) {
        return fail('VALIDATION_ERROR', '该时间段已有预约')
      }
    }

    const appointmentId = createAppointmentId()
    await transaction.collection('appointments').doc(appointmentId).set({ data: appointment })
    await writeAppointmentLocks(transaction, appointmentId, appointment, 'pending')

    return {
      success: true,
      appointmentId: appointmentId,
      appointment: { _id: appointmentId, ...appointment }
    }
  })
}

// 取消预约
async function cancelAppointment({ openid, event }) {
  const { appointmentId } = event

  if (!hasValue(appointmentId)) {
    return fail('VALIDATION_ERROR', '缺少预约ID')
  }

  if (typeof db.runTransaction !== 'function') {
    return fail('VALIDATION_ERROR', '当前云开发环境不支持事务，无法安全取消预约')
  }

  return await db.runTransaction(async transaction => {
    const res = await transaction.collection('appointments').doc(appointmentId).get()
    const appointment = res.data
    if (!appointment) {
      return fail('APPOINTMENT_NOT_FOUND', '预约不存在')
    }

    if (appointment.blindOpenid !== openid && appointment.volunteerOpenid !== openid) {
      return fail('FORBIDDEN', '无权取消此预约')
    }

    if (['cancelled', 'completed'].includes(appointment.status)) {
      return fail('INVALID_APPOINTMENT_STATUS', '该预约无法取消')
    }

    await transaction.collection('appointments').doc(appointmentId).update({
      data: {
        status: 'cancelled',
        cancelBy: openid,
        cancelTime: db.serverDate()
      }
    })

    await writeAppointmentLocks(transaction, appointmentId, appointment, 'cancelled')
    return { success: true }
  })
}

async function confirmAppointment({ openid, user, event }) {
  const { appointmentId } = event

  if (!hasValue(appointmentId)) {
    return fail('VALIDATION_ERROR', '缺少预约ID')
  }

  if (user.userType !== 'volunteer') {
    return fail('FORBIDDEN', '只有志愿者可以确认预约')
  }

  if (!user.videoWatched || !user.examPassed || !hasValue(user.certificateNo)) {
    return fail('TRAINING_REQUIRED', '请先完成培训、考试并获得证书')
  }

  if (typeof db.runTransaction !== 'function') {
    return fail('VALIDATION_ERROR', '当前云开发环境不支持事务，无法安全确认预约')
  }

  return await db.runTransaction(async transaction => {
    const res = await transaction.collection('appointments').doc(appointmentId).get()
    const appointment = res.data

    if (!appointment) {
      return fail('APPOINTMENT_NOT_FOUND', '预约不存在')
    }

    if (appointment.volunteerOpenid !== openid) {
      return fail('FORBIDDEN', '无权确认此预约')
    }

    if (appointment.status !== 'pending') {
      return fail('INVALID_APPOINTMENT_STATUS', '当前预约状态无法确认')
    }

    await transaction.collection('appointments').doc(appointmentId).update({
      data: {
        status: 'confirmed',
        confirmedBy: openid,
        confirmedAt: db.serverDate()
      }
    })

    await writeAppointmentLocks(transaction, appointmentId, appointment, 'confirmed')
    return { success: true }
  })
}

// 完成预约（志愿者操作）
async function completeAppointment({ openid, event }) {
  const { appointmentId, rating, comment } = event

  if (!hasValue(appointmentId)) {
    return fail('VALIDATION_ERROR', '缺少预约ID')
  }

  if (typeof db.runTransaction !== 'function') {
    return fail('VALIDATION_ERROR', '当前云开发环境不支持事务，无法安全完成预约')
  }

  return await db.runTransaction(async transaction => {
    const res = await transaction.collection('appointments').doc(appointmentId).get()
    const appointment = res.data

    if (!appointment) {
      return fail('APPOINTMENT_NOT_FOUND', '预约不存在')
    }

    // 验证权限：仅视障用户可以确认完成与评分
    if (appointment.blindOpenid !== openid) {
      return fail('FORBIDDEN', '只有视障用户可以完成并评价预约')
    }

    if (appointment.status === 'completed') {
      return fail('INVALID_APPOINTMENT_STATUS', '该预约已完成')
    }

    if (appointment.status === 'cancelled') {
      return fail('INVALID_APPOINTMENT_STATUS', '已取消的预约无法完成')
    }

    if (appointment.rewardApplied) {
      return fail('INVALID_APPOINTMENT_STATUS', '预约奖励已发放')
    }

    if (appointment.status !== 'confirmed') {
      return fail('INVALID_APPOINTMENT_STATUS', '预约需由志愿者确认后才能完成')
    }

    const participants = await resolveAppointmentParticipants(appointment)
    if (participants.error) return participants.error

    const completedAt = db.serverDate()
    const updateData = {
      status: 'completed',
      completedBy: openid,
      completedAt,
      rewardApplied: true,
      rewardAppliedAt: completedAt
    }

    updateRequesterRating(updateData, rating, comment)

    await transaction.collection('appointments').doc(appointmentId).update({
      data: updateData
    })
    await writeAppointmentLocks(transaction, appointmentId, appointment, 'completed')

    await transaction.collection('users').doc(participants.blindUserId).update({
      data: {
        totalRuns: _.inc(1),
        exp: _.inc(30),
        updatedAt: db.serverDate()
      }
    })

    await transaction.collection('users').doc(participants.volunteerUserId).update({
      data: {
        totalRuns: _.inc(1),
        points: _.inc(10),
        exp: _.inc(50),
        updatedAt: db.serverDate()
      }
    })

    return { success: true }
  })
}

// 按日期获取预约
async function getAppointmentsByDate({ openid, event }) {
  const { date } = event

  if (!date) {
    return fail('VALIDATION_ERROR', '请指定日期')
  }

  const res = await db.collection('appointments')
    .where(_.and([
      _.or([
        { blindOpenid: openid },
        { volunteerOpenid: openid }
      ]),
      { appointmentDate: date },
      { status: _.in(['pending', 'confirmed']) }
    ]))
    .orderBy('appointmentTime', 'asc')
    .get()

  return {
    success: true,
    appointments: res.data
  }
}

async function resolveVolunteer({ volunteerOpenid, volunteerId }) {
  let volunteer = null

  if (hasValue(volunteerId)) {
    try {
      const res = await db.collection('users').doc(volunteerId).get()
      volunteer = res.data || null
    } catch (e) {
      volunteer = null
    }
  }

  if (!volunteer && hasValue(volunteerOpenid)) {
    const res = await db.collection('users')
      .where(_.or([
        { openid: volunteerOpenid },
        { miniOpenid: volunteerOpenid }
      ]))
      .limit(1)
      .get()
    volunteer = res.data[0] || null
  }

  if (!volunteer || volunteer.userType !== 'volunteer') {
    return { error: fail('VALIDATION_ERROR', '志愿者不存在') }
  }

  return { user: volunteer }
}

async function resolveUserByOpenid(openid) {
  const res = await db.collection('users')
    .where(_.or([
      { openid },
      { miniOpenid: openid }
    ]))
    .limit(1)
    .get()

  if (res.data.length === 0) {
    return { error: fail('VALIDATION_ERROR', '视障用户不存在') }
  }

  return { user: res.data[0] }
}

async function resolveAppointmentParticipants(appointment) {
  const blindUser = appointment.blindUserId
    ? await getUserById(appointment.blindUserId)
    : await getUserByOpenid(appointment.blindOpenid)
  const volunteerUser = appointment.volunteerUserId
    ? await getUserById(appointment.volunteerUserId)
    : await getUserByOpenid(appointment.volunteerOpenid)

  if (!blindUser || !volunteerUser ||
      blindUser.userType !== 'disabled' ||
      volunteerUser.userType !== 'volunteer' ||
      !matchesUserOpenid(blindUser, appointment.blindOpenid) ||
      !matchesUserOpenid(volunteerUser, appointment.volunteerOpenid)) {
    return { error: fail('VALIDATION_ERROR', '预约用户信息不完整') }
  }

  return {
    blindUserId: blindUser._id,
    volunteerUserId: volunteerUser._id
  }
}

async function getUserById(userId) {
  if (!hasValue(userId)) return null
  try {
    const res = await db.collection('users').doc(userId).get()
    return res.data || null
  } catch (e) {
    return null
  }
}

async function getUserByOpenid(openid) {
  if (!hasValue(openid)) return null
  const res = await db.collection('users')
    .where(_.or([
      { openid },
      { miniOpenid: openid }
    ]))
    .limit(1)
    .get()

  return res.data[0] || null
}

async function getTransactionDoc(transaction, collectionName, docId) {
  try {
    const res = await transaction.collection(collectionName).doc(docId).get()
    return res.data || null
  } catch (e) {
    return null
  }
}

async function writeAppointmentLocks(transaction, appointmentId, appointment, status) {
  const lockIds = Array.isArray(appointment.slotLockIds) && appointment.slotLockIds.length > 0
    ? appointment.slotLockIds
    : [
        appointmentLockId(appointment.blindOpenid, appointment.appointmentDate, appointment.appointmentTime),
        appointmentLockId(appointment.volunteerOpenid, appointment.appointmentDate, appointment.appointmentTime)
      ]

  for (const lockId of lockIds) {
    await transaction.collection('appointment_locks').doc(lockId).set({
      data: {
        appointmentId: appointmentId,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: status,
        updatedAt: db.serverDate()
      }
    })
  }
}

function appointmentLockId(openid, appointmentDate, appointmentTime) {
  const hash = crypto
    .createHash('sha1')
    .update(`${openid}:${appointmentDate}:${appointmentTime}`)
    .digest('hex')
  return `appt_lock_${hash}`
}

function createAppointmentId() {
  return `appt_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`
}

function matchesUserOpenid(user, openid) {
  return user.openid === openid || user.miniOpenid === openid || user.webOpenid === openid
}

function updateRequesterRating(updateData, rating, comment) {
  const parsedRating = Number(rating)
  if (Number.isFinite(parsedRating) && parsedRating >= 1 && parsedRating <= 5) {
    updateData.rating = parsedRating
  }
  if (hasValue(comment)) {
    updateData.comment = String(comment)
  }
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}
