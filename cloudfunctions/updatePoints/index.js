// 云函数：更新用户积分
// 功能：使用事务确保原子性操作
// 支持：完成订单增加积分、兑换商品扣除积分

const cloud = require('wx-server-sdk')
const { fail } = require('./shared/responses')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

// 段位配置
const TIER_SYSTEM = {
  volunteer: [
    { level: 1, name: '启明之星', minRuns: 0 },
    { level: 2, name: '破晓勇士', minRuns: 5 },
    { level: 3, name: '烈阳守护', minRuns: 15 },
    { level: 4, name: '领跑天使', minRuns: 30 }
  ],
  disabled: [
    { level: 1, name: '初心跑者', minRuns: 0 },
    { level: 2, name: '疾风跑者', minRuns: 5 },
    { level: 3, name: '极速护卫', minRuns: 15 },
    { level: 4, name: '光明统帅', minRuns: 30 }
  ]
}

// 积分规则
const POINTS_RULES = {
  volunteer: {
    perRun: { points: 10, exp: 50 },
    perFeedback: { exp: 20 }
  },
  disabled: {
    perRun: { exp: 30 },
    consecutiveCheckIn: { exp: 50, days: 3 }
  }
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const action = event.action

  try {
    switch (action) {
      case 'completeOrder':
        return fail('FORBIDDEN', '订单完成奖励由订单流程自动发放')
      case 'exchange':
        return await exchangeProduct(openid, event)
      case 'checkIn':
        return await handleCheckIn(openid, event)
      case 'feedback':
        return await handleFeedback(openid, event)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('updatePoints error:', err)
    return { success: false, error: err.message }
  }
}

// 完成订单增加积分
async function completeOrderAddPoints(openid, event) {
  const { orderId } = event

  // 获取订单信息
  const orderRes = await db.collection('orders').doc(orderId).get()
  if (!orderRes.data) {
    return { success: false, error: '订单不存在' }
  }
  const order = orderRes.data

  // 通过 openid 查找用户（server-to-server 调用时 _id 查找可能不可靠）
  const blindRes = await db.collection('users').where({ openid: order.openid }).get()
  const volRes = await db.collection('users').where({ openid: order.volunteerOpenid }).get()

  if (blindRes.data.length === 0 || volRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }

  const blindUser = blindRes.data[0]
  const volUser = volRes.data[0]

  // 计算增加积分
  const volRules = POINTS_RULES.volunteer
  const blindRules = POINTS_RULES.disabled

  const volEarned = {
    points: volRules.perRun.points,
    exp: volRules.perRun.exp
  }

  const blindEarned = {
    exp: blindRules.perRun.exp
  }

  // 使用事务更新双方积分
  try {
    await db.runTransaction(async transaction => {
      // 更新志愿者
      const volUpdate = {
        points: _.inc(volEarned.points),
        exp: _.inc(volEarned.exp),
        totalRuns: _.inc(1),
        updatedAt: db.serverDate()
      }

      // 检查是否升级
      const newVolRuns = (volUser.totalRuns || 0) + 1
      const volTier = calculateTier('volunteer', newVolRuns)
      if (volTier.level > volUser.tierLevel) {
        volUpdate.tierLevel = volTier.level
        volUpdate.tierName = volTier.name
      }

      await transaction.collection('users').doc(volUser._id).update({
        data: volUpdate
      })

      // 更新盲人
      const blindUpdate = {
        exp: _.inc(blindEarned.exp),
        totalRuns: _.inc(1),
        updatedAt: db.serverDate()
      }

      const newBlindRuns = (blindUser.totalRuns || 0) + 1
      const blindTier = calculateTier('disabled', newBlindRuns)
      if (blindTier.level > blindUser.tierLevel) {
        blindUpdate.tierLevel = blindTier.level
        blindUpdate.tierName = blindTier.name
      }

      await transaction.collection('users').doc(blindUser._id).update({
        data: blindUpdate
      })
    })

    return {
      success: true,
      volunteerEarned: volEarned,
      blindEarned: blindEarned,
      volunteerTierUp: volUser.tierLevel < calculateTier('volunteer', volUser.totalRuns + 1).level,
      blindTierUp: blindUser.tierLevel < calculateTier('disabled', blindUser.totalRuns + 1).level
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// 兑换商品（使用事务）
async function exchangeProduct(openid, event) {
  const { productId, productName, productPrice } = event

  // 获取用户
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }
  const user = userRes.data[0]

  if (user.points < productPrice) {
    return {
      success: false,
      error: '积分不足',
      currentPoints: user.points,
      needPoints: productPrice
    }
  }

  // 获取商品
  const productRes = await db.collection('products').doc(productId).get()
  if (!productRes.data) {
    return { success: false, error: '商品不存在' }
  }
  const product = productRes.data

  if (product.stock <= 0) {
    return { success: false, error: '商品已售罄' }
  }

  // 生成兑换码
  const exchangeCode = 'EX' + Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).substr(2, 4).toUpperCase()

  // 使用事务
  try {
    await db.runTransaction(async transaction => {
      // 扣除积分
      await transaction.collection('users').doc(user._id).update({
        data: {
          points: _.inc(-productPrice),
          updatedAt: db.serverDate()
        }
      })

      // 减少库存
      await transaction.collection('products').doc(productId).update({
        data: {
          stock: _.inc(-1),
          sold: _.inc(1)
        }
      })

      // 创建兑换订单
      await transaction.collection('exchange_orders').add({
        data: {
          openid: openid,
          userId: user._id,
          productId: productId,
          productName: productName,
          price: productPrice,
          code: exchangeCode,
          status: 'pending',
          expiredTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          createdAt: db.serverDate()
        }
      })
    })

    return {
      success: true,
      exchangeCode: exchangeCode,
      remainingPoints: user.points - productPrice
    }
  } catch (err) {
    return { success: false, error: '兑换失败，请重试' }
  }
}

// 每日打卡
async function handleCheckIn(openid, event) {
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }
  const user = userRes.data[0]
  const today = new Date().toLocaleDateString()
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString()

  let checkInDays = user.checkInDays || 0
  let earnedExp = 5
  let message = '打卡成功！+5经验'

  if (user.lastCheckInDate === today) {
    return { success: false, error: '今日已打卡', alreadyCheckedIn: true }
  } else if (user.lastCheckInDate === yesterday) {
    // 连续打卡，在之前的基础上 +1
    checkInDays = checkInDays + 1
  } else {
    // 中断或首次打卡，重置为1
    checkInDays = 1
  }

  // 连续三天奖励
  const rules = POINTS_RULES.disabled
  if (rules.consecutiveCheckIn && checkInDays >= 3) {
    earnedExp += rules.consecutiveCheckIn.exp
    message = `连续打卡3天！+${earnedExp}经验`
    checkInDays = 0
  }

  await db.collection('users').doc(user._id).update({
    data: {
      exp: _.inc(earnedExp),
      checkInDays: checkInDays,
      lastCheckInDate: today,
      updatedAt: db.serverDate()
    }
  })

  return {
    success: true,
    earnedExp: earnedExp,
    message: message,
    checkInDays: checkInDays
  }
}

// 获得好评
async function handleFeedback(openid, event) {
  const { orderId, rating } = event
  const ratingValue = Number(rating)

  if (!orderId) {
    return fail('VALIDATION_ERROR', '缺少订单ID')
  }

  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    return fail('VALIDATION_ERROR', '评分必须为1到5分')
  }

  if (typeof db.runTransaction !== 'function') {
    return fail('VALIDATION_ERROR', '当前云开发环境不支持事务，无法安全记录评价')
  }

  return await db.runTransaction(async transaction => {
    const orderRes = await transaction.collection('orders').doc(orderId).get()
    const order = orderRes.data

    if (!order) {
      return fail('ORDER_NOT_FOUND', '订单不存在')
    }

    if (order.openid !== openid) {
      return fail('FORBIDDEN', '只有订单发布者可以评价')
    }

    if (order.status !== 'completed') {
      return fail('INVALID_ORDER_STATUS', '订单完成后才能评价')
    }

    if (order.feedbackSubmitted || order.feedbackRewardApplied) {
      return fail('INVALID_ORDER_STATUS', '该订单已评价')
    }

    const feedbackData = {
      rating: ratingValue,
      feedbackSubmitted: true,
      feedbackAt: db.serverDate(),
      feedbackBy: openid
    }

    let earnedExp = 0
    if (ratingValue >= 3) {
      if (!order.volunteerId) {
        return fail('VALIDATION_ERROR', '订单志愿者信息不完整')
      }

      earnedExp = POINTS_RULES.volunteer.perFeedback.exp
      feedbackData.feedbackRewardApplied = true
      feedbackData.feedbackRewardAppliedAt = db.serverDate()

      await transaction.collection('users').doc(order.volunteerId).update({
        data: {
          exp: _.inc(earnedExp),
          likes: _.inc(1),
          updatedAt: db.serverDate()
        }
      })
    }

    await transaction.collection('orders').doc(orderId).update({
      data: feedbackData
    })

    return { success: true, earnedExp: earnedExp }
  })
}

// 计算段位
function calculateTier(userType, totalRuns) {
  const tiers = TIER_SYSTEM[userType] || TIER_SYSTEM.disabled

  for (let i = tiers.length - 1; i >= 0; i--) {
    if (totalRuns >= tiers[i].minRuns) {
      return tiers[i]
    }
  }

  return tiers[0]
}
