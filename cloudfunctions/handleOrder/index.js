// 云函数：处理订单操作
// 功能：发布订单、接单、取消订单、完成订单

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action // 'publish' | 'accept' | 'cancel' | 'complete'

  try {
    switch (action) {
      case 'publish':
        return await publishOrder(openid, event)
      case 'accept':
        return await acceptOrder(openid, event)
      case 'cancel':
        return await cancelOrder(openid, event)
      case 'complete':
        return await completeOrder(openid, event)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('handleOrder error:', err)
    return { success: false, error: err.message }
  }
}

// 发布订单
async function publishOrder(openid, event) {
  const { targetDistance, estimatedDuration, latitude, longitude, address } = event

  // 获取用户信息
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }
  const user = userRes.data[0]

  // 创建订单
  const order = {
    openid: openid, // 盲人openid
    userName: user.name || user.nickName,
    userId: user._id,
    targetDistance,
    estimatedDuration,
    latitude,
    longitude,
    address: address || '',
    // 志愿者信息（接单后填充）
    volunteerOpenid: '',
    volunteerName: '',
    volunteerId: '',
    volunteerPhone: '',
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
async function acceptOrder(openid, event) {
  const { orderId } = event

  // 检查订单是否存在且状态为等待中
  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return { success: false, error: '订单不存在' }
  }
  if (orderRes.data.status !== 'waiting') {
    return { success: false, error: '订单已被接走或已取消' }
  }

  // 获取志愿者信息
  const volRes = await db.collection('users').where({ openid: openid }).get()
  if (volRes.data.length === 0) {
    return { success: false, error: '志愿者不存在' }
  }
  const volunteer = volRes.data[0]

  // 更新订单
  await db.collection('orders').doc(orderId).update({
    data: {
      volunteerOpenid: openid,
      volunteerName: volunteer.name || volunteer.nickName,
      volunteerId: volunteer._id,
      volunteerPhone: volunteer.phone || '',
      status: 'accepted',
      acceptTime: new Date().toLocaleString()
    }
  })

  return {
    success: true,
    order: {
      ...orderRes.data,
      volunteerOpenid: openid,
      volunteerName: volunteer.name || volunteer.nickName,
      status: 'accepted'
    }
  }
}

// 取消订单
async function cancelOrder(openid, event) {
  const { orderId } = event

  // 检查订单
  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return { success: false, error: '订单不存在' }
  }

  // 验证权限：只有发布者或接单者可以取消
  if (orderRes.data.openid !== openid && orderRes.data.volunteerOpenid !== openid) {
    return { success: false, error: '无权取消此订单' }
  }

  // 不能取消已完成或已取消的订单
  if (['completed', 'cancelled'].includes(orderRes.data.status)) {
    return { success: false, error: '该订单无法取消' }
  }

  // 更新订单状态
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'cancelled',
      cancelTime: new Date().toLocaleString(),
      cancelBy: orderRes.data.openid === openid ? 'blind' : 'volunteer'
    }
  })

  return { success: true }
}

// 完成订单
async function completeOrder(openid, event) {
  const { orderId, actualDistance, duration, rating, comment } = event

  // 检查订单
  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return { success: false, error: '订单不存在' }
  }

  // 验证权限：只有接单者可以完成
  if (orderRes.data.volunteerOpenid !== openid) {
    return { success: false, error: '只有接单志愿者可以完成订单' }
  }

  // 更新订单
  await db.collection('orders').doc(orderId).update({
    data: {
      status: 'completed',
      endTime: new Date().toLocaleString(),
      actualDistance: actualDistance || '',
      duration: duration || 0,
      rating: rating || 0,
      comment: comment || '',
      completedAt: db.serverDate()
    }
  })

  // TODO: 调用 updatePoints 云函数增加积分（通过云调用）
  try {
    await cloud.callFunction({
      name: 'updatePoints',
      data: {
        action: 'completeOrder',
        orderId: orderId
      }
    })
  } catch (e) {
    console.error('调用积分更新失败:', e)
  }

  return { success: true }
}
