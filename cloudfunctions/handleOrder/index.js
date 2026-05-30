// 云函数：处理订单操作
// 功能：发布订单、接单、取消订单、完成订单、查询订单

const cloud = require('wx-server-sdk')
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
      case 'publish':
        return await publishOrder(params)
      case 'accept':
        return await acceptOrder(params)
      case 'cancel':
        return await cancelOrder(params)
      case 'complete':
        return await completeOrder(params)
      case 'getMyOrders':
        return await getMyOrders(params)
      case 'getWaitingOrders':
        return await getWaitingOrders(params)
      case 'getOrderDetail':
        return await getOrderDetail(params)
      case 'updateVolunteerLocation':
        return await updateVolunteerLocation(params)
      case 'updateOrderStatus':
        return await updateOrderStatus(params)
      default:
        return fail('VALIDATION_ERROR', '未知操作')
    }
  } catch (err) {
    console.error('handleOrder error:', err)
    return { success: false, error: err.message }
  }
}

// 发布订单
async function publishOrder({ openid, user, event }) {
  const { targetDistance, estimatedDuration, latitude, longitude, address } = event
  const parsedLatitude = Number(latitude)
  const parsedLongitude = Number(longitude)

  if (user.userType !== 'disabled') {
    return fail('FORBIDDEN', '只有视障用户可以发布陪跑需求')
  }

  if (!hasValue(targetDistance) || !hasValue(estimatedDuration) ||
      !hasValue(latitude) || !hasValue(longitude) ||
      !Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return fail('VALIDATION_ERROR', '请填写目标里程、预计时间和有效位置')
  }

  // 创建订单
  const order = {
    openid: openid, // 盲人openid
    userName: user.name || user.nickName,
    userId: user._id,
    targetDistance,
    estimatedDuration,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    address: address || '',
    // 志愿者信息（接单后填充）
    volunteerOpenid: '',
    volunteerName: '',
    volunteerId: '',
    // 订单状态
    status: 'waiting', // waiting-等待中, accepted-已接单, arrived-已到达, running-陪跑中, completed-已完成, cancelled-已取消
    // 时间和位置
    publishTime: new Date().toLocaleString(),
    acceptTime: '',
    startTime: '',
    endTime: '',
    volunteerLat: 0,
    volunteerLng: 0,
    // 跑步数据
    actualDistance: '',
    duration: 0,
    // 评价
    rating: 0,
    comment: '',
    // 统计
    createdAt: db.serverDate()
  }

  const addRes = await db.collection('orders').add({
    data: order
  })

  return {
    success: true,
    orderId: addRes._id,
    order: { _id: addRes._id, ...order }
  }
}

// 接单
async function acceptOrder({ openid, user, event }) {
  const { orderId } = event

  if (!orderId) {
    return fail('VALIDATION_ERROR', '缺少订单ID')
  }

  if (user.userType !== 'volunteer') {
    return fail('FORBIDDEN', '只有志愿者可以接单')
  }

  if (!user.videoWatched || !user.examPassed || !hasValue(user.certificateNo)) {
    return fail('TRAINING_REQUIRED', '请先完成培训、考试并获得证书')
  }

  // 检查订单是否存在且状态为等待中
  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return fail('ORDER_NOT_FOUND', '订单不存在')
  }
  if (orderRes.data.status !== 'waiting') {
    if (['accepted', 'arrived', 'running'].includes(orderRes.data.status)) {
      return fail('ORDER_ALREADY_ACCEPTED', '订单已被接走')
    }
    return fail('INVALID_ORDER_STATUS', '当前订单状态无法接单')
  }

  // 更新订单
  const acceptRes = await db.collection('orders')
    .where({ _id: orderId, status: 'waiting' })
    .update({
      data: {
        volunteerOpenid: openid,
        volunteerName: user.name || user.nickName,
        volunteerId: user._id,
        status: 'accepted',
        acceptTime: new Date().toLocaleString()
      }
    })

  if (!acceptRes.stats || acceptRes.stats.updated !== 1) {
    const latestOrderRes = await db.collection('orders').doc(orderId).get()
    if (!latestOrderRes.data) {
      return fail('ORDER_NOT_FOUND', '订单不存在')
    }
    if (['accepted', 'arrived', 'running'].includes(latestOrderRes.data.status)) {
      return fail('ORDER_ALREADY_ACCEPTED', '订单已被接走')
    }
    return fail('INVALID_ORDER_STATUS', '当前订单状态无法接单')
  }

  return {
    success: true,
    order: {
      ...orderRes.data,
      volunteerOpenid: openid,
      volunteerName: user.name || user.nickName,
      status: 'accepted'
    }
  }
}

// 取消订单
async function cancelOrder({ openid, event }) {
  const { orderId } = event

  if (!orderId) {
    return fail('VALIDATION_ERROR', '缺少订单ID')
  }

  // 检查订单
  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return fail('ORDER_NOT_FOUND', '订单不存在')
  }

  // 验证权限：只有发布者或接单者可以取消
  if (orderRes.data.openid !== openid && orderRes.data.volunteerOpenid !== openid) {
    return fail('FORBIDDEN', '无权取消此订单')
  }

  // 不能取消已完成或已取消的订单
  if (['completed', 'cancelled'].includes(orderRes.data.status)) {
    return fail('INVALID_ORDER_STATUS', '该订单无法取消')
  }

  // 更新订单状态
  const cancelRes = await db.collection('orders')
    .where({
      _id: orderId,
      status: _.nin(['completed', 'cancelled'])
    })
    .update({
      data: {
        status: 'cancelled',
        cancelTime: new Date().toLocaleString(),
        cancelBy: orderRes.data.openid === openid ? 'blind' : 'volunteer'
      }
    })

  if (!cancelRes.stats || cancelRes.stats.updated !== 1) {
    return fail('INVALID_ORDER_STATUS', '该订单无法取消')
  }

  return { success: true }
}

// 完成订单
async function completeOrder({ openid, user, event }) {
  const { orderId, actualDistance, duration } = event

  if (!orderId) {
    return fail('VALIDATION_ERROR', '缺少订单ID')
  }

  if (user.userType !== 'volunteer') {
    return fail('FORBIDDEN', '只有接单志愿者可以完成订单')
  }

  if (typeof db.runTransaction !== 'function') {
    return fail('VALIDATION_ERROR', '当前云开发环境不支持事务，无法安全完成订单')
  }

  const actualDistanceValue = parsePositiveNumber(actualDistance, '实际距离')
  if (actualDistanceValue.error) return actualDistanceValue.error
  const durationValue = parsePositiveNumber(duration, '陪跑时长')
  if (durationValue.error) return durationValue.error

  return await db.runTransaction(async transaction => {
    const orderRes = await transaction.collection('orders').doc(orderId).get()
    const order = orderRes.data

    if (!order) {
      return fail('ORDER_NOT_FOUND', '订单不存在')
    }

    if (order.volunteerOpenid !== openid) {
      return fail('FORBIDDEN', '只有接单志愿者可以完成订单')
    }

    if (order.rewardApplied) {
      return fail('INVALID_ORDER_STATUS', '该订单奖励已发放')
    }

    if (['completed', 'cancelled'].includes(order.status)) {
      return fail('INVALID_ORDER_STATUS', '该订单无法完成')
    }

    if (order.status !== 'running') {
      return fail('INVALID_ORDER_STATUS', '订单开始陪跑后才能完成')
    }

    if (!order.userId || !order.volunteerId) {
      return fail('VALIDATION_ERROR', '订单用户信息不完整')
    }

    const completedAt = db.serverDate()
    await transaction.collection('orders').doc(orderId).update({
      data: {
        status: 'completed',
        endTime: new Date().toLocaleString(),
        actualDistance: actualDistanceValue.value,
        duration: durationValue.value,
        completedAt,
        rewardApplied: true,
        rewardAppliedAt: completedAt
      }
    })

    const volunteerUpdate = {
      points: _.inc(10),
      exp: _.inc(50),
      totalRuns: _.inc(1),
      updatedAt: db.serverDate()
    }

    await transaction.collection('users').doc(order.volunteerId).update({
      data: volunteerUpdate
    })

    await transaction.collection('users').doc(order.userId).update({
      data: {
        exp: _.inc(30),
        totalRuns: _.inc(1),
        updatedAt: db.serverDate()
      }
    })

    return { success: true }
  })
}

// 获取我的订单（盲人看自己发布的，志愿者看自己接的）
async function getMyOrders({ openid, user, event }) {
  const { status, page = 1, pageSize = 20 } = event

  let whereCondition = {}
  if (user.userType === 'disabled') {
    whereCondition.openid = openid
  } else {
    whereCondition.volunteerOpenid = openid
  }

  if (status && status !== 'all') {
    whereCondition.status = status
  }

  const countRes = await db.collection('orders')
    .where(whereCondition)
    .count()

  const res = await db.collection('orders')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    orders: res.data,
    total: countRes.total,
    page: page,
    pageSize: pageSize
  }
}

// 获取等待中的订单（志愿者浏览可接单列表）
async function getWaitingOrders({ user, event }) {
  const { page = 1, pageSize = 20, latitude, longitude } = event

  if (user.userType !== 'volunteer') {
    return fail('FORBIDDEN', '只有志愿者可以查看待接订单')
  }

  if (!user.videoWatched || !user.examPassed || !hasValue(user.certificateNo)) {
    return fail('TRAINING_REQUIRED', '请先完成培训、考试并获得证书')
  }

  const res = await db.collection('orders')
    .where({ status: 'waiting' })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  let orders = res.data

  // 如果提供了坐标，计算距离
  if (latitude && longitude) {
    orders = orders.map(order => {
      if (order.latitude && order.longitude) {
        order.distance = calculateDistance(latitude, longitude, order.latitude, order.longitude)
      }
      return order
    }).sort((a, b) => (a.distance || 999999) - (b.distance || 999999))
  }

  const countRes = await db.collection('orders')
    .where({ status: 'waiting' })
    .count()

  const safeOrders = orders.map(publicWaitingOrder)

  return {
    success: true,
    orders: safeOrders,
    total: countRes.total,
    page: page,
    pageSize: pageSize
  }
}

// 获取订单详情（盲人端轮询用）
async function getOrderDetail({ openid, event }) {
  const { orderId } = event

  if (!orderId) {
    // 获取用户最新的活跃订单
    const res = await db.collection('orders')
      .where({
        openid: openid,
        status: _.in(['waiting', 'accepted', 'arrived', 'running'])
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (res.data.length === 0) {
      return fail('ORDER_NOT_FOUND', '没有活跃订单')
    }
    return { success: true, order: res.data[0] }
  }

  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return fail('ORDER_NOT_FOUND', '订单不存在')
  }

  if (orderRes.data.openid !== openid && orderRes.data.volunteerOpenid !== openid) {
    return fail('FORBIDDEN', '无权查看此订单')
  }

  return { success: true, order: orderRes.data }
}

// 更新志愿者实时位置及跑步数据（志愿者端陪跑时调用）
async function updateVolunteerLocation({ openid, event }) {
  const { orderId, latitude, longitude, runningStats, runningPath } = event

  if (!orderId) {
    return fail('VALIDATION_ERROR', '缺少订单ID')
  }

  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return fail('ORDER_NOT_FOUND', '订单不存在')
  }

  if (orderRes.data.volunteerOpenid !== openid) {
    return fail('FORBIDDEN', '无权更新此订单')
  }

  const updateData = {
    volunteerLat: latitude,
    volunteerLng: longitude
  }

  // 同步跑步实时数据
  if (runningStats) {
    updateData.runningStats = runningStats
  }
  if (runningPath && runningPath.length > 0) {
    updateData.runningPath = runningPath
  }

  await db.collection('orders').doc(orderId).update({
    data: updateData
  })

  return { success: true }
}

// 更新订单状态（arrived/running）
async function updateOrderStatus({ openid, event }) {
  const { orderId, status } = event

  if (!orderId || !status) {
    return fail('VALIDATION_ERROR', '缺少参数')
  }

  const validTransitions = {
    'arrived': ['accepted'],
    'running': ['accepted', 'arrived']
  }

  if (!validTransitions[status]) {
    return fail('VALIDATION_ERROR', '无效的状态')
  }

  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return fail('ORDER_NOT_FOUND', '订单不存在')
  }

  if (orderRes.data.volunteerOpenid !== openid) {
    return fail('FORBIDDEN', '无权操作此订单')
  }

  if (!validTransitions[status].includes(orderRes.data.status)) {
    return fail('INVALID_ORDER_STATUS', `当前状态 ${orderRes.data.status} 不能转为 ${status}`)
  }

  const updateData = { status: status }
  if (status === 'running') {
    updateData.startTime = new Date().toLocaleString()
  }

  const updateRes = await db.collection('orders')
    .where({
      _id: orderId,
      volunteerOpenid: openid,
      status: _.in(validTransitions[status])
    })
    .update({
      data: updateData
    })

  if (!updateRes.stats || updateRes.stats.updated !== 1) {
    return fail('INVALID_ORDER_STATUS', `当前状态 ${orderRes.data.status} 不能转为 ${status}`)
  }

  return { success: true }
}

// Haversine 公式计算距离（米）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== ''
}

function parsePositiveNumber(value, label) {
  if (!hasValue(value)) {
    return { error: fail('VALIDATION_ERROR', `请填写${label}`) }
  }

  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    return { error: fail('VALIDATION_ERROR', `${label}必须为正数`) }
  }

  return { value: number }
}

function publicWaitingOrder(order) {
  const result = {
    _id: order._id,
    userName: order.userName || '',
    targetDistance: order.targetDistance || '',
    estimatedDuration: order.estimatedDuration || '',
    latitude: order.latitude,
    longitude: order.longitude,
    address: order.address || '',
    publishTime: order.publishTime || '',
    status: order.status || 'waiting'
  }

  if (typeof order.distance === 'number') {
    result.distance = Math.round(order.distance)
  }

  return result
}
