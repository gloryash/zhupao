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
  const {
    targetDistance,
    estimatedDuration,
    latitude,
    longitude,
    address,
    origin = {},
    destination = {},
    destinationLatitude,
    destinationLongitude,
    destinationAddress,
    runTimeWindow,
    timeWindow,
    city,
    departureMode,
    departureOffsetMinutes,
    departureAt,
    departureLabel
  } = event
  const parsedLatitude = Number(coalesce(origin.latitude, latitude))
  const parsedLongitude = Number(coalesce(origin.longitude, longitude))
  const parsedDestinationLatitude = parseOptionalNumber(coalesce(destination.latitude, destinationLatitude))
  const parsedDestinationLongitude = parseOptionalNumber(coalesce(destination.longitude, destinationLongitude))
  const originAddress = coalesce(origin.address, address, '')
  const destAddress = coalesce(destination.address, destinationAddress, '')
  const orderCity = coalesce(city, origin.city, destination.city, inferCity(originAddress), inferCity(destAddress), '')
  const runnerAge = parseOptionalNumber(coalesce(user.age, user.userAge))
  const runnerGender = coalesce(user.gender, user.sex, user.userGender, '')
  const runnerProfile = orderPartyProfile(user)
  const departure = normalizeDeparture({
    departureMode,
    departureOffsetMinutes,
    departureAt,
    departureLabel,
    runTimeWindow: coalesce(runTimeWindow, timeWindow, 'immediate')
  })

  if (user.userType !== 'disabled') {
    return fail('FORBIDDEN', '只有视障用户可以发布陪跑需求')
  }

  if (!hasValue(targetDistance) || !hasValue(estimatedDuration) ||
      !hasValue(parsedLatitude) || !hasValue(parsedLongitude) ||
      !Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
    return fail('VALIDATION_ERROR', '请填写目标里程、预计时间和有效位置')
  }

  // 创建订单
  const order = {
    openid: openid, // 盲人openid
    userName: user.name || user.nickName,
    userId: user._id,
    userPhone: runnerProfile.phone,
    userAvatarUrl: runnerProfile.avatarUrl,
    runnerName: runnerProfile.name,
    runnerPhone: runnerProfile.phone,
    runnerAvatarUrl: runnerProfile.avatarUrl,
    runnerTotalRuns: runnerProfile.totalRuns || 0,
    runnerTotalDistance: runnerProfile.totalDistance || 0,
    runningLocation: runnerProfile.runningLocation || '',
    runnerProfile,
    targetDistance,
    estimatedDuration,
    latitude: parsedLatitude,
    longitude: parsedLongitude,
    address: originAddress || '',
    origin: {
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      address: originAddress || '',
      city: orderCity || ''
    },
    originLatitude: parsedLatitude,
    originLongitude: parsedLongitude,
    originAddress: originAddress || '',
    destination: {
      latitude: parsedDestinationLatitude,
      longitude: parsedDestinationLongitude,
      address: destAddress || '',
      city: coalesce(destination.city, orderCity, '')
    },
    destinationLatitude: parsedDestinationLatitude,
    destinationLongitude: parsedDestinationLongitude,
    destinationAddress: destAddress || '',
    city: orderCity || '',
    runTimeWindow: departure.runTimeWindow,
    departureMode: departure.mode,
    departureOffsetMinutes: departure.offsetMinutes,
    departureAt: departure.at,
    departureHour: departure.hour,
    departureDate: departure.date,
    departureLabel: departure.label,
    runnerLatitude: parsedLatitude,
    runnerLongitude: parsedLongitude,
    runnerGender,
    runnerAge,
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
  const { orderId, latitude, longitude } = event
  const volunteerLatitude = parseOptionalNumber(latitude)
  const volunteerLongitude = parseOptionalNumber(longitude)

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
  const runnerUser = await findOrderPartyUser(orderRes.data, 'runner')
  const runnerProfile = orderPartyProfile(runnerUser || {
    _id: orderRes.data.userId,
    openid: orderRes.data.openid,
    userType: 'disabled',
    name: orderRes.data.runnerName || orderRes.data.userName,
    phone: orderRes.data.runnerPhone
  })
  const volunteerProfile = orderPartyProfile(user)
  const updateData = {
    runnerName: runnerProfile.name || orderRes.data.runnerName || orderRes.data.userName || '',
    runnerPhone: runnerProfile.phone || orderRes.data.runnerPhone || '',
    userPhone: runnerProfile.phone || orderRes.data.userPhone || orderRes.data.runnerPhone || '',
    userAvatarUrl: runnerProfile.avatarUrl || orderRes.data.userAvatarUrl || '',
    runnerAvatarUrl: runnerProfile.avatarUrl || orderRes.data.runnerAvatarUrl || '',
    runnerTotalRuns: runnerProfile.totalRuns || orderRes.data.runnerTotalRuns || 0,
    runnerTotalDistance: runnerProfile.totalDistance || orderRes.data.runnerTotalDistance || 0,
    runningLocation: runnerProfile.runningLocation || orderRes.data.runningLocation || '',
    runnerProfile,
    volunteerOpenid: openid,
    volunteerName: volunteerProfile.name || user.name || user.nickName,
    volunteerId: user._id,
    volunteerPhone: volunteerProfile.phone,
    volunteerAvatarUrl: volunteerProfile.avatarUrl,
    volunteerTierName: volunteerProfile.tierName,
    volunteerTotalRuns: volunteerProfile.totalRuns || 0,
    volunteerTotalDistance: volunteerProfile.totalDistance || 0,
    volunteerRunningYears: volunteerProfile.runningYears || '',
    volunteerPace: volunteerProfile.pace || '',
    volunteerHasMarathon: volunteerProfile.hasMarathon || '',
    volunteerHasFirstAid: volunteerProfile.hasFirstAid || '',
    volunteerHasCompanionExp: volunteerProfile.hasCompanionExp || '',
    volunteerCertificateNo: volunteerProfile.certificateNo || '',
    volunteerProfile,
    status: 'accepted',
    acceptTime: new Date().toLocaleString()
  }
  if (Number.isFinite(volunteerLatitude) && Number.isFinite(volunteerLongitude)) {
    updateData.volunteerLat = volunteerLatitude
    updateData.volunteerLng = volunteerLongitude
  }

  const acceptRes = await db.collection('orders')
    .where({ _id: orderId, status: 'waiting' })
    .update({
      data: updateData
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
      runnerName: updateData.runnerName,
      runnerPhone: updateData.runnerPhone,
      userPhone: updateData.userPhone,
      userAvatarUrl: updateData.userAvatarUrl,
      runnerAvatarUrl: updateData.runnerAvatarUrl,
      runnerTotalRuns: updateData.runnerTotalRuns,
      runnerTotalDistance: updateData.runnerTotalDistance,
      runningLocation: updateData.runningLocation,
      runnerProfile: updateData.runnerProfile,
      volunteerOpenid: openid,
      volunteerName: updateData.volunteerName,
      volunteerId: user._id,
      volunteerPhone: updateData.volunteerPhone,
      volunteerAvatarUrl: updateData.volunteerAvatarUrl,
      volunteerTierName: updateData.volunteerTierName,
      volunteerTotalRuns: updateData.volunteerTotalRuns,
      volunteerTotalDistance: updateData.volunteerTotalDistance,
      volunteerRunningYears: updateData.volunteerRunningYears,
      volunteerPace: updateData.volunteerPace,
      volunteerHasMarathon: updateData.volunteerHasMarathon,
      volunteerHasFirstAid: updateData.volunteerHasFirstAid,
      volunteerHasCompanionExp: updateData.volunteerHasCompanionExp,
      volunteerCertificateNo: updateData.volunteerCertificateNo,
      volunteerProfile: updateData.volunteerProfile,
      status: 'accepted',
      ...(Number.isFinite(volunteerLatitude) && Number.isFinite(volunteerLongitude)
        ? { volunteerLat: volunteerLatitude, volunteerLng: volunteerLongitude }
        : {})
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

  const orders = await enrichOrdersForPrivateView(res.data)

  return {
    success: true,
    orders,
    total: countRes.total,
    page: page,
    pageSize: pageSize
  }
}

// 获取等待中的订单（志愿者浏览可接单列表）
async function getWaitingOrders({ user, event }) {
  const {
    page = 1,
    pageSize = 20,
    latitude,
    longitude,
    maxDistance = 20000,
    distanceBasis = 'origin',
    gender = 'all',
    ageRange = 'all',
    timeWindow = 'all',
    city = 'all',
    departureFilterType = 'all',
    departureHour,
    departureDate,
    departureWithinMinutes
  } = event

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

  orders = filterWaitingOrders(orders, {
    gender,
    ageRange,
    timeWindow,
    city,
    departureFilterType,
    departureHour,
    departureDate,
    departureWithinMinutes
  })

  const parsedLatitude = Number(latitude)
  const parsedLongitude = Number(longitude)
  const parsedMaxDistance = Number(maxDistance)

  // 如果提供了坐标，计算距离并默认保留方圆 20 公里内的需求
  if (Number.isFinite(parsedLatitude) && Number.isFinite(parsedLongitude)) {
    orders = orders.map(order => {
      const point = orderPointForDistance(order, distanceBasis)
      if (point) {
        order.distance = calculateDistance(parsedLatitude, parsedLongitude, point.latitude, point.longitude)
        order.distanceBasis = distanceBasis === 'runner' ? 'runner' : 'origin'
      }
      return order
    })
    if (Number.isFinite(parsedMaxDistance) && parsedMaxDistance > 0) {
      orders = orders.filter(order => typeof order.distance !== 'number' || order.distance <= parsedMaxDistance)
    }
    orders = orders.sort((a, b) => (a.distance || 999999) - (b.distance || 999999))
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
    return { success: true, order: await enrichOrderForPrivateView(res.data[0]) }
  }

  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return fail('ORDER_NOT_FOUND', '订单不存在')
  }

  if (orderRes.data.openid !== openid && orderRes.data.volunteerOpenid !== openid) {
    return fail('FORBIDDEN', '无权查看此订单')
  }

  return { success: true, order: await enrichOrderForPrivateView(orderRes.data) }
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
    origin: order.origin || {
      latitude: order.originLatitude || order.latitude,
      longitude: order.originLongitude || order.longitude,
      address: order.originAddress || order.address || '',
      city: order.city || ''
    },
    originLatitude: order.originLatitude || order.latitude,
    originLongitude: order.originLongitude || order.longitude,
    originAddress: order.originAddress || order.address || '',
    destination: order.destination || {
      latitude: order.destinationLatitude,
      longitude: order.destinationLongitude,
      address: order.destinationAddress || '',
      city: order.city || ''
    },
    destinationLatitude: order.destinationLatitude,
    destinationLongitude: order.destinationLongitude,
    destinationAddress: order.destinationAddress || '',
    city: order.city || '',
    runTimeWindow: order.runTimeWindow || 'immediate',
    departureMode: order.departureMode || (order.runTimeWindow === 'immediate' ? 'immediate' : 'delayed'),
    departureOffsetMinutes: Number.isFinite(Number(order.departureOffsetMinutes)) ? Number(order.departureOffsetMinutes) : 0,
    departureAt: order.departureAt || '',
    departureHour: Number.isFinite(Number(order.departureHour)) ? Number(order.departureHour) : null,
    departureDate: order.departureDate || '',
    departureLabel: order.departureLabel || timeWindowLabel(order.runTimeWindow || 'immediate'),
    runnerGender: order.runnerGender || '',
    runnerAge: order.runnerAge || null,
    runnerLatitude: order.runnerLatitude || order.latitude,
    runnerLongitude: order.runnerLongitude || order.longitude,
    publishTime: order.publishTime || '',
    status: order.status || 'waiting'
  }

  if (typeof order.distance === 'number') {
    result.distance = Math.round(order.distance)
  }
  if (order.distanceBasis) result.distanceBasis = order.distanceBasis

  return result
}

async function enrichOrdersForPrivateView(orders) {
  const enriched = []
  for (const order of orders) {
    enriched.push(await enrichOrderForPrivateView(order))
  }
  return enriched
}

async function enrichOrderForPrivateView(order) {
  if (!order) return order
  const result = { ...order }

  if (!hasValue(result.runnerPhone) || !result.runnerProfile) {
    const runner = await findOrderPartyUser(result, 'runner')
    if (runner) {
      applyRunnerProfile(result, orderPartyProfile(runner))
    } else {
      applyRunnerProfile(result, orderPartyProfile({
        _id: result.userId,
        openid: result.openid,
        userType: 'disabled',
        name: result.runnerName || result.userName,
        phone: result.runnerPhone
      }))
    }
  }

  if (hasValue(result.volunteerOpenid) && (!hasValue(result.volunteerPhone) || !result.volunteerProfile)) {
    const volunteer = await findOrderPartyUser(result, 'volunteer')
    if (volunteer) {
      applyVolunteerProfile(result, orderPartyProfile(volunteer))
    } else {
      applyVolunteerProfile(result, orderPartyProfile({
        _id: result.volunteerId,
        openid: result.volunteerOpenid,
        userType: 'volunteer',
        name: result.volunteerName,
        phone: result.volunteerPhone
      }))
    }
  }

  return result
}

async function findOrderPartyUser(order, party) {
  if (!order) return null
  const id = party === 'volunteer' ? order.volunteerId : order.userId
  const openid = party === 'volunteer' ? order.volunteerOpenid : order.openid

  if (hasValue(id)) {
    try {
      const doc = await db.collection('users').doc(id).get()
      if (doc.data) return doc.data
    } catch (err) {
      console.warn(`find ${party} by id failed`, err.message)
    }
  }

  if (hasValue(openid)) {
    try {
      const res = await db.collection('users').where({ openid }).limit(1).get()
      if (res.data.length > 0) return res.data[0]
    } catch (err) {
      console.warn(`find ${party} by openid failed`, err.message)
    }
  }

  return null
}

function applyRunnerProfile(order, profile) {
  if (!profile) return
  order.runnerName = profile.name || order.runnerName || order.userName || ''
  order.userName = order.userName || profile.name || ''
  order.runnerPhone = profile.phone || order.runnerPhone || ''
  order.userPhone = profile.phone || order.userPhone || order.runnerPhone || ''
  order.userAvatarUrl = profile.avatarUrl || order.userAvatarUrl || ''
  order.runnerAvatarUrl = profile.avatarUrl || order.runnerAvatarUrl || ''
  order.runnerTotalRuns = profile.totalRuns || order.runnerTotalRuns || 0
  order.runnerTotalDistance = profile.totalDistance || order.runnerTotalDistance || 0
  order.runningLocation = profile.runningLocation || order.runningLocation || ''
  order.runnerProfile = profile
}

function applyVolunteerProfile(order, profile) {
  if (!profile) return
  order.volunteerName = profile.name || order.volunteerName || ''
  order.volunteerPhone = profile.phone || order.volunteerPhone || ''
  order.volunteerAvatarUrl = profile.avatarUrl || order.volunteerAvatarUrl || ''
  order.volunteerTierName = profile.tierName || order.volunteerTierName || ''
  order.volunteerTotalRuns = profile.totalRuns || order.volunteerTotalRuns || 0
  order.volunteerTotalDistance = profile.totalDistance || order.volunteerTotalDistance || 0
  order.volunteerRunningYears = profile.runningYears || order.volunteerRunningYears || ''
  order.volunteerPace = profile.pace || order.volunteerPace || ''
  order.volunteerHasMarathon = profile.hasMarathon || order.volunteerHasMarathon || ''
  order.volunteerHasFirstAid = profile.hasFirstAid || order.volunteerHasFirstAid || ''
  order.volunteerHasCompanionExp = profile.hasCompanionExp || order.volunteerHasCompanionExp || ''
  order.volunteerCertificateNo = profile.certificateNo || order.volunteerCertificateNo || ''
  order.volunteerProfile = profile
}

function orderPartyProfile(user) {
  if (!user) return null
  const phone = coalesce(user.phone, user.mobile, user.tel, fallbackTestPhone(user))
  const profile = compactObject({
    userId: user._id || '',
    openid: user.openid || '',
    userType: user.userType || '',
    name: coalesce(user.name, user.nickName, '用户'),
    nickName: user.nickName || '',
    avatarUrl: user.avatarUrl || '',
    phone,
    gender: coalesce(user.gender, user.sex, user.userGender, ''),
    age: parseOptionalNumber(coalesce(user.age, user.userAge)),
    tierName: user.tierName || '',
    totalRuns: numberOrNull(user.totalRuns),
    totalDistance: numberOrNull(user.totalDistance),
    totalTime: numberOrNull(user.totalTime),
    likes: numberOrNull(user.likes),
    certificateNo: user.certificateNo || '',
    runningYears: user.runningYears || '',
    pace: user.pace || '',
    hasMarathon: user.hasMarathon || '',
    hasFirstAid: user.hasFirstAid || '',
    hasCompanionExp: user.hasCompanionExp || '',
    runningLocation: user.runningLocation || '',
    resume: user.resume || ''
  })
  return profile
}

function fallbackTestPhone(user) {
  const source = String(user._id || user.openid || user.email || user.nickName || user.name || '')
  if (!source) return ''
  let hash = 0
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0
  }
  return `199${String(hash % 100000000).padStart(8, '0')}`
}

function compactObject(input) {
  const result = {}
  for (const key of Object.keys(input)) {
    if (input[key] !== undefined && input[key] !== null) {
      result[key] = input[key]
    }
  }
  return result
}

function numberOrNull(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function coalesce(...values) {
  for (const value of values) {
    if (hasValue(value)) return value
  }
  return undefined
}

function parseOptionalNumber(value) {
  if (!hasValue(value)) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function normalizeTimeWindow(value) {
  const allowed = ['immediate', 'morning', 'afternoon', 'evening', 'delayed', 'scheduled']
  return allowed.includes(value) ? value : 'immediate'
}

function normalizeDeparture(input) {
  const rawWindow = normalizeTimeWindow(input.runTimeWindow || 'immediate')
  const mode = input.departureMode === 'delayed' || input.departureMode === 'scheduled' || rawWindow !== 'immediate'
    ? 'delayed'
    : 'immediate'
  const requestedOffset = parseOptionalNumber(input.departureOffsetMinutes)
  const offsetMinutes = mode === 'delayed'
    ? Math.max(1, Math.min(24 * 60 - 1, Math.round(Number(requestedOffset || 0))))
    : 0
  const now = new Date()
  const parsedAt = hasValue(input.departureAt) ? new Date(input.departureAt) : null
  const atDate = mode === 'delayed'
    ? (parsedAt && Number.isFinite(parsedAt.getTime()) ? parsedAt : new Date(now.getTime() + offsetMinutes * 60 * 1000))
    : now
  const runTimeWindow = mode === 'delayed' && rawWindow === 'immediate' ? 'delayed' : rawWindow
  const label = hasValue(input.departureLabel)
    ? String(input.departureLabel)
    : mode === 'delayed'
      ? formatDelayLabel(offsetMinutes)
      : timeWindowLabel(runTimeWindow)

  return {
    mode,
    offsetMinutes,
    at: atDate.toISOString(),
    hour: atDate.getHours(),
    date: formatLocalDate(atDate),
    label,
    runTimeWindow
  }
}

function formatDelayLabel(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours > 0 && mins > 0) return `${hours}小时${mins}分钟后出发`
  if (hours > 0) return `${hours}小时后出发`
  return `${mins}分钟后出发`
}

function formatLocalDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function timeWindowLabel(value) {
  if (value === 'morning') return '上午'
  if (value === 'afternoon') return '下午'
  if (value === 'evening') return '晚上'
  if (value === 'delayed' || value === 'scheduled') return '延后出发'
  return '立即出发'
}

function inferCity(address) {
  if (!address) return ''
  const knownCities = ['上海', '北京', '广州', '深圳', '杭州', '南京', '苏州', '成都', '重庆', '武汉', '西安', '天津', '宁波', '厦门', '青岛', '济南', '长沙', '郑州']
  const found = knownCities.find(city => String(address).includes(city))
  return found ? `${found}市` : ''
}

function filterWaitingOrders(orders, filters) {
  const city = normalizeCityName(filters.city)
  return orders.filter(order => {
    if (filters.gender && filters.gender !== 'all' && order.runnerGender && order.runnerGender !== filters.gender) {
      return false
    }
    if (filters.timeWindow && filters.timeWindow !== 'all' && !matchesTimeWindow(order, filters.timeWindow)) {
      return false
    }
    if (city && city !== 'all') {
      const orderCity = normalizeCityName(order.city || inferCity(order.originAddress || order.address || '') || inferCity(order.destinationAddress || ''))
      if (!orderCity || orderCity !== city) return false
    }
    if (!matchesDepartureFilter(order, filters)) {
      return false
    }
    if (filters.ageRange && filters.ageRange !== 'all') {
      const age = Number(order.runnerAge)
      if (Number.isFinite(age)) {
        const [min, max] = String(filters.ageRange).split('-').map(Number)
        if (Number.isFinite(min) && age < min) return false
        if (Number.isFinite(max) && age > max) return false
      }
    }
    return true
  })
}

function normalizeCityName(value) {
  const raw = String(value || '').trim()
  if (!raw || raw === 'all') return raw || 'all'
  return raw
    .replace(/(特别行政区|地区|盟)$/g, '')
    .replace(/市辖区$/g, '')
    .replace(/市$/g, '')
}

function matchesTimeWindow(order, timeWindow) {
  const value = String(timeWindow || 'all')
  if (value === 'all') return true
  const mode = order.departureMode || (order.runTimeWindow === 'immediate' ? 'immediate' : 'delayed')
  if (value === 'immediate') return mode === 'immediate' || (order.runTimeWindow || 'immediate') === 'immediate'
  if (value === 'delayed' || value === 'scheduled') return mode === 'delayed' || ['delayed', 'scheduled'].includes(order.runTimeWindow)
  return (order.runTimeWindow || 'immediate') === value
}

function matchesDepartureFilter(order, filters) {
  const type = String(filters.departureFilterType || 'all')
  if (type === 'all') return true

  const mode = order.departureMode || (order.runTimeWindow === 'immediate' ? 'immediate' : 'delayed')
  if (type === 'immediate') return mode === 'immediate'

  if (type === 'within') {
    const minutes = Number(filters.departureWithinMinutes)
    if (!Number.isFinite(minutes) || minutes <= 0) return true
    const departureTime = parseDepartureTime(order)
    if (!departureTime) return mode === 'immediate'
    const now = Date.now()
    return departureTime >= now - 60 * 1000 && departureTime <= now + minutes * 60 * 1000
  }

  if (type === 'hour') {
    const hour = Number(filters.departureHour)
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return true
    const orderHour = Number(order.departureHour)
    return Number.isInteger(orderHour) && orderHour === hour
  }

  if (type === 'date') {
    const date = String(filters.departureDate || '').trim()
    if (!date) return true
    return String(order.departureDate || '') === date
  }

  return true
}

function parseDepartureTime(order) {
  if (!hasValue(order.departureAt)) return null
  const time = new Date(order.departureAt).getTime()
  return Number.isFinite(time) ? time : null
}

function orderPointForDistance(order, distanceBasis) {
  if (distanceBasis === 'runner') {
    const latitude = Number(coalesce(order.runnerLatitude, order.latitude))
    const longitude = Number(coalesce(order.runnerLongitude, order.longitude))
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) return { latitude, longitude }
  }
  const latitude = Number(coalesce(order.originLatitude, order.latitude))
  const longitude = Number(coalesce(order.originLongitude, order.longitude))
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}
