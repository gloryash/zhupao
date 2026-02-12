// 云函数：用户相关操作
// 功能：获取用户信息、更新紧急联系人、更新个人资料

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
      case 'getUserProfile':
        return await getUserProfile(openid)
      case 'updateProfile':
        return await updateProfile(openid, event)
      case 'updateEmergencyContact':
        return await updateEmergencyContact(openid, event)
      case 'getEmergencyContact':
        return await getEmergencyContact(openid)
      case 'getUserStats':
        return await getUserStats(openid)
      case 'updateLocation':
        return await updateLocation(openid, event)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('handleUser error:', err)
    return { success: false, error: err.message }
  }
}

// 获取用户完整信息
async function getUserProfile(openid) {
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }

  const user = userRes.data[0]

  return {
    success: true,
    user: user
  }
}

// 更新用户资料
async function updateProfile(openid, event) {
  const { nickName, avatarUrl, name, phone } = event

  const updateData = { updatedAt: db.serverDate() }

  if (nickName !== undefined) updateData.nickName = nickName
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
  if (name !== undefined) updateData.name = name
  if (phone !== undefined) updateData.phone = phone

  await db.collection('users').where({ openid: openid }).update({
    data: updateData
  })

  // 返回更新后的用户信息
  const userRes = await db.collection('users').where({ openid: openid }).get()

  return {
    success: true,
    user: userRes.data[0]
  }
}

// 更新紧急联系人
async function updateEmergencyContact(openid, event) {
  const { emergencyName, emergencyPhone, emergencyRelation } = event

  if (!emergencyPhone) {
    return { success: false, error: '请填写紧急联系人电话' }
  }

  await db.collection('users').where({ openid: openid }).update({
    data: {
      emergencyName: emergencyName || '',
      emergencyPhone: emergencyPhone,
      emergencyRelation: emergencyRelation || '',
      updatedAt: db.serverDate()
    }
  })

  return {
    success: true,
    emergencyContact: {
      name: emergencyName || '',
      phone: emergencyPhone,
      relation: emergencyRelation || ''
    }
  }
}

// 获取紧急联系人
async function getEmergencyContact(openid) {
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }

  const user = userRes.data[0]

  return {
    success: true,
    emergencyContact: {
      name: user.emergencyName || '',
      phone: user.emergencyPhone || '',
      relation: user.emergencyRelation || ''
    }
  }
}

// 获取用户统计数据
async function getUserStats(openid) {
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }

  const user = userRes.data[0]

  // 获取订单统计
  let orderCount = 0
  if (user.userType === 'disabled') {
    const orderRes = await db.collection('orders')
      .where({ openid: openid, status: 'completed' })
      .count()
    orderCount = orderRes.total
  } else {
    const orderRes = await db.collection('orders')
      .where({ volunteerOpenid: openid, status: 'completed' })
      .count()
    orderCount = orderRes.total
  }

  return {
    success: true,
    stats: {
      points: user.points || 0,
      exp: user.exp || 0,
      totalRuns: user.totalRuns || 0,
      totalDistance: user.totalDistance || 0,
      totalTime: user.totalTime || 0,
      tierLevel: user.tierLevel || 1,
      tierName: user.tierName || '',
      likes: user.likes || 0,
      medals: user.medals || 0,
      checkInDays: user.checkInDays || 0,
      lastCheckInDate: user.lastCheckInDate || '',
      completedOrders: orderCount,
      examPassed: user.examPassed || false,
      videoWatched: user.videoWatched || false
    }
  }
}

// 更新用户位置
async function updateLocation(openid, event) {
  const { latitude, longitude } = event

  if (latitude === undefined || longitude === undefined) {
    return { success: false, error: '请提供位置信息' }
  }

  await db.collection('users').where({ openid: openid }).update({
    data: {
      latitude: latitude,
      longitude: longitude,
      locationUpdatedAt: db.serverDate()
    }
  })

  return { success: true }
}
