// 云函数：志愿者相关操作
// 功能：获取志愿者列表、可用性管理、常联系人

const cloud = require('wx-server-sdk')
const { resolveIdentity, requireUser } = require('./shared/auth')
const { ok, fail } = require('./shared/responses')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  event = event || {}
  const action = event.action

  try {
    let openid = ''
    let identity = null
    if (action !== 'getVolunteers' && action !== 'getVolunteerDetail') {
      identity = await resolveIdentity(db, event)
      const authError = requireUser(identity)
      if (authError) return authError
      openid = identity.openid
    }

    switch (action) {
      case 'getVolunteers':
        return await getVolunteers(event)
      case 'getAvailableVolunteers':
        return await getAvailableVolunteers(openid, event)
      case 'updateAvailability':
        if (identity.user.userType !== 'volunteer') {
          return fail('FORBIDDEN', '只有志愿者可以切换接单状态')
        }
        return await updateAvailability(openid, event)
      case 'getFrequentContacts':
        return await getFrequentContacts(openid, event)
      case 'getVolunteerDetail':
        return await getVolunteerDetail(event)
      default:
        return fail('VALIDATION_ERROR', '未知操作')
    }
  } catch (err) {
    console.error('handleVolunteer error:', err)
    return fail('INTERNAL_ERROR', err.message)
  }
}

// 获取志愿者列表
async function getVolunteers(event) {
  const { page = 1, pageSize = 20, keyword } = event

  let whereCondition = {
    userType: 'volunteer',
    examPassed: true
  }

  const countRes = await db.collection('users')
    .where(whereCondition)
    .count()

  const res = await db.collection('users')
    .where(whereCondition)
    .orderBy('totalRuns', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .field({
      _id: true,
      openid: true,
      nickName: true,
      name: true,
      avatarUrl: true,
      tierLevel: true,
      tierName: true,
      totalRuns: true,
      totalDistance: true,
      likes: true,
      isAvailable: true,
      latitude: true,
      longitude: true
    })
    .get()

  return {
    success: true,
    volunteers: res.data,
    total: countRes.total,
    page: page,
    pageSize: pageSize
  }
}

// 获取可用志愿者（正在接单的）
async function getAvailableVolunteers(openid, event) {
  const { latitude, longitude, radius = 5000 } = event

  // 获取所有正在接单的志愿者
  const res = await db.collection('users')
    .where({
      userType: 'volunteer',
      isAvailable: true,
      examPassed: true
    })
    .field({
      _id: true,
      openid: true,
      nickName: true,
      name: true,
      avatarUrl: true,
      tierLevel: true,
      tierName: true,
      totalRuns: true,
      likes: true,
      latitude: true,
      longitude: true,
      phone: true
    })
    .get()

  // 如果提供了坐标，计算距离并排序
  let volunteers = res.data
  if (latitude && longitude) {
    volunteers = volunteers
      .map(v => {
        if (v.latitude && v.longitude) {
          v.distance = calculateDistance(latitude, longitude, v.latitude, v.longitude)
        } else {
          v.distance = 999999
        }
        return v
      })
      .filter(v => v.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
  }

  return {
    success: true,
    volunteers: volunteers,
    total: volunteers.length
  }
}

// 更新志愿者可用状态和位置
async function updateAvailability(openid, event) {
  const { isAvailable, latitude, longitude } = event

  const updateData = {
    isAvailable: isAvailable,
    updatedAt: db.serverDate()
  }

  if (latitude !== undefined && longitude !== undefined) {
    updateData.latitude = latitude
    updateData.longitude = longitude
  }

  await db.collection('users').where({ openid: openid }).update({
    data: updateData
  })

  return { success: true, isAvailable: isAvailable }
}

// 获取常联系人（基于陪跑记录统计）
async function getFrequentContacts(openid, event) {
  const { limit = 10 } = event

  // 获取用户信息确定类型
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }
  const user = userRes.data[0]

  // 根据用户类型查询订单
  let whereCondition = {}
  if (user.userType === 'disabled') {
    whereCondition = { openid: openid, status: 'completed' }
  } else {
    whereCondition = { volunteerOpenid: openid, status: 'completed' }
  }

  const ordersRes = await db.collection('orders')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()

  // 统计联系频率
  const contactMap = {}
  ordersRes.data.forEach(order => {
    let contactOpenid, contactName
    if (user.userType === 'disabled') {
      contactOpenid = order.volunteerOpenid
      contactName = order.volunteerName
    } else {
      contactOpenid = order.openid
      contactName = order.userName
    }

    if (contactOpenid) {
      if (!contactMap[contactOpenid]) {
        contactMap[contactOpenid] = {
          openid: contactOpenid,
          name: contactName,
          count: 0,
          lastTime: order.completedAt || order.createdAt
        }
      }
      contactMap[contactOpenid].count++
    }
  })

  // 排序并取前N个
  const contacts = Object.values(contactMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)

  // 获取联系人详细信息
  for (let contact of contacts) {
    try {
      const contactUser = await db.collection('users')
        .where({ openid: contact.openid })
        .field({
          nickName: true, name: true, avatarUrl: true,
          tierLevel: true, tierName: true, totalRuns: true, likes: true
        })
        .get()
      if (contactUser.data.length > 0) {
        Object.assign(contact, contactUser.data[0])
      }
    } catch (e) {
      // 跳过获取失败的
    }
  }

  return {
    success: true,
    contacts: contacts,
    total: contacts.length
  }
}

// 获取志愿者详情
async function getVolunteerDetail(event) {
  const { volunteerId } = event

  const res = await db.collection('users').doc(volunteerId).get()
  if (!res.data) {
    return { success: false, error: '志愿者不存在' }
  }

  const volunteer = res.data
  // 不返回敏感信息
  delete volunteer.phone
  delete volunteer.emergencyPhone

  return {
    success: true,
    volunteer: volunteer
  }
}

// Haversine 公式计算两点距离（米）
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg) {
  return deg * Math.PI / 180
}
