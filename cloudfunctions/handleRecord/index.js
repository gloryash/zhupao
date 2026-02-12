// 云函数：运动记录相关操作
// 功能：保存/获取运动记录、陪跑记录

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
      case 'saveSportRecord':
        return await saveSportRecord(openid, event)
      case 'getSportRecords':
        return await getSportRecords(openid, event)
      case 'saveCompanionRecord':
        return await saveCompanionRecord(openid, event)
      case 'getCompanionRecords':
        return await getCompanionRecords(openid, event)
      case 'deleteRecords':
        return await deleteRecords(openid, event)
      case 'getTodayStats':
        return await getTodayStats(openid, event)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('handleRecord error:', err)
    return { success: false, error: err.message }
  }
}

// 保存运动记录
async function saveSportRecord(openid, event) {
  const { distance, duration, calories, pace, trajectory, startTime, endTime } = event

  const record = {
    openid: openid,
    type: 'sport',
    distance: distance || 0,
    duration: duration || 0,
    calories: calories || 0,
    pace: pace || '',
    trajectory: trajectory || [],
    startTime: startTime || '',
    endTime: endTime || '',
    date: new Date().toLocaleDateString(),
    createdAt: db.serverDate()
  }

  const addRes = await db.collection('sport_records').add({ data: record })

  // 更新用户累计数据
  await db.collection('users').where({ openid: openid }).update({
    data: {
      totalDistance: _.inc(distance || 0),
      totalTime: _.inc(duration || 0),
      updatedAt: db.serverDate()
    }
  })

  return {
    success: true,
    recordId: addRes._id,
    record: { _id: addRes._id, ...record }
  }
}

// 获取运动记录
async function getSportRecords(openid, event) {
  const { page = 1, pageSize = 20, date } = event

  let whereCondition = { openid: openid, type: 'sport' }
  if (date) {
    whereCondition.date = date
  }

  const countRes = await db.collection('sport_records')
    .where(whereCondition)
    .count()

  const res = await db.collection('sport_records')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    records: res.data,
    total: countRes.total,
    page: page,
    pageSize: pageSize
  }
}

// 保存陪跑记录
async function saveCompanionRecord(openid, event) {
  const {
    orderId, partnerName, partnerType, distance, duration,
    rating, comment, startTime, endTime
  } = event

  // 获取用户信息
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }
  const user = userRes.data[0]

  const record = {
    openid: openid,
    type: 'companion',
    orderId: orderId || '',
    userName: user.nickName || user.name,
    userType: user.userType,
    partnerName: partnerName || '',
    partnerType: partnerType || '',
    distance: distance || 0,
    duration: duration || 0,
    rating: rating || 0,
    comment: comment || '',
    startTime: startTime || '',
    endTime: endTime || '',
    date: new Date().toLocaleDateString(),
    createdAt: db.serverDate()
  }

  const addRes = await db.collection('sport_records').add({ data: record })

  return {
    success: true,
    recordId: addRes._id,
    record: { _id: addRes._id, ...record }
  }
}

// 获取陪跑记录
async function getCompanionRecords(openid, event) {
  const { page = 1, pageSize = 20 } = event

  const countRes = await db.collection('sport_records')
    .where({ openid: openid, type: 'companion' })
    .count()

  const res = await db.collection('sport_records')
    .where({ openid: openid, type: 'companion' })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    records: res.data,
    total: countRes.total,
    page: page,
    pageSize: pageSize
  }
}

// 删除记录
async function deleteRecords(openid, event) {
  const { recordIds, deleteAll } = event

  if (deleteAll) {
    // 删除用户所有陪跑记录
    const res = await db.collection('sport_records')
      .where({ openid: openid, type: 'companion' })
      .remove()
    return { success: true, deleted: res.stats.removed }
  }

  if (recordIds && recordIds.length > 0) {
    let deleted = 0
    for (const id of recordIds) {
      try {
        const record = await db.collection('sport_records').doc(id).get()
        if (record.data && record.data.openid === openid) {
          await db.collection('sport_records').doc(id).remove()
          deleted++
        }
      } catch (e) {
        // 记录不存在，跳过
      }
    }
    return { success: true, deleted: deleted }
  }

  return { success: false, error: '请指定要删除的记录' }
}

// 获取今日统计
async function getTodayStats(openid, event) {
  const today = new Date().toLocaleDateString()

  const res = await db.collection('sport_records')
    .where({ openid: openid, date: today })
    .get()

  let totalDistance = 0
  let totalDuration = 0
  let totalCalories = 0
  let runCount = 0

  res.data.forEach(record => {
    totalDistance += record.distance || 0
    totalDuration += record.duration || 0
    totalCalories += record.calories || 0
    runCount++
  })

  return {
    success: true,
    stats: {
      date: today,
      totalDistance,
      totalDuration,
      totalCalories,
      runCount
    }
  }
}
