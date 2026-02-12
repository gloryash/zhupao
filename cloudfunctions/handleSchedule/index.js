// 云函数：日程相关操作
// 功能：预约管理（创建、获取、取消预约）

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action

  try {
    switch (action) {
      case 'getAppointments':
        return await getAppointments(openid, event)
      case 'createAppointment':
        return await createAppointment(openid, event)
      case 'cancelAppointment':
        return await cancelAppointment(openid, event)
      case 'getAppointmentsByDate':
        return await getAppointmentsByDate(openid, event)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('handleSchedule error:', err)
    return { success: false, error: err.message }
  }
}

// 获取用户所有预约
async function getAppointments(openid, event) {
  const { status, page = 1, pageSize = 20 } = event

  let whereCondition = {
    _: _.or([
      { blindOpenid: openid },
      { volunteerOpenid: openid }
    ])
  }

  if (status && status !== 'all') {
    whereCondition.status = status
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
async function createAppointment(openid, event) {
  const {
    volunteerOpenid, volunteerName, volunteerAvatar,
    appointmentDate, appointmentTime, location, address,
    targetDistance, estimatedDuration, note
  } = event

  // 获取发起者信息
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }
  const user = userRes.data[0]

  // 检查时间冲突
  const conflictRes = await db.collection('appointments')
    .where({
      _: _.or([
        { blindOpenid: openid },
        { volunteerOpenid: openid }
      ]),
      appointmentDate: appointmentDate,
      appointmentTime: appointmentTime,
      status: _.in(['pending', 'confirmed'])
    })
    .count()

  if (conflictRes.total > 0) {
    return { success: false, error: '该时间段已有预约' }
  }

  const appointment = {
    blindOpenid: user.userType === 'disabled' ? openid : (event.blindOpenid || ''),
    blindName: user.userType === 'disabled' ? (user.nickName || user.name) : (event.blindName || ''),
    volunteerOpenid: user.userType === 'volunteer' ? openid : (volunteerOpenid || ''),
    volunteerName: user.userType === 'volunteer' ? (user.nickName || user.name) : (volunteerName || ''),
    volunteerAvatar: volunteerAvatar || '',
    appointmentDate: appointmentDate,
    appointmentTime: appointmentTime,
    location: location || {},
    address: address || '',
    targetDistance: targetDistance || '',
    estimatedDuration: estimatedDuration || '',
    note: note || '',
    status: 'pending', // pending-待确认, confirmed-已确认, cancelled-已取消, completed-已完成
    createdBy: openid,
    createdAt: db.serverDate()
  }

  const addRes = await db.collection('appointments').add({ data: appointment })

  return {
    success: true,
    appointmentId: addRes._id,
    appointment: { _id: addRes._id, ...appointment }
  }
}

// 取消预约
async function cancelAppointment(openid, event) {
  const { appointmentId } = event

  const res = await db.collection('appointments').doc(appointmentId).get()
  if (!res.data) {
    return { success: false, error: '预约不存在' }
  }

  // 验证权限
  if (res.data.blindOpenid !== openid && res.data.volunteerOpenid !== openid) {
    return { success: false, error: '无权取消此预约' }
  }

  if (['cancelled', 'completed'].includes(res.data.status)) {
    return { success: false, error: '该预约无法取消' }
  }

  await db.collection('appointments').doc(appointmentId).update({
    data: {
      status: 'cancelled',
      cancelBy: openid,
      cancelTime: db.serverDate()
    }
  })

  return { success: true }
}

// 按日期获取预约
async function getAppointmentsByDate(openid, event) {
  const { date } = event

  if (!date) {
    return { success: false, error: '请指定日期' }
  }

  const res = await db.collection('appointments')
    .where({
      _: _.or([
        { blindOpenid: openid },
        { volunteerOpenid: openid }
      ]),
      appointmentDate: date,
      status: _.in(['pending', 'confirmed'])
    })
    .orderBy('appointmentTime', 'asc')
    .get()

  return {
    success: true,
    appointments: res.data
  }
}
