// 云函数：同步用户信息
// 功能：用户登录时自动检查数据库，有信息则返回，无信息则新增

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { normalizePhone } = require('./shared/user')
const { fail } = require('./shared/responses')

async function findExistingUser(openid) {
  const openidRes = await db.collection('users').where({ openid }).limit(1).get()
  if (openidRes.data.length > 0) {
    return { user: openidRes.data[0], matchedBy: 'openid' }
  }

  const miniOpenidRes = await db.collection('users').where({ miniOpenid: openid }).limit(1).get()
  if (miniOpenidRes.data.length > 0) {
    return { user: miniOpenidRes.data[0], matchedBy: 'miniOpenid' }
  }

  return { user: null, matchedBy: '' }
}

async function findUserByPhone(phone) {
  if (phone) {
    const phoneRes = await db.collection('users').where({ phone }).limit(1).get()
    if (phoneRes.data.length > 0) {
      return phoneRes.data[0]
    }
  }

  return null
}

function mergeAuthSources(existingUser) {
  const authSources = Array.isArray(existingUser.authSources) ? existingUser.authSources : []
  return authSources.includes('miniapp') ? authSources : authSources.concat('miniapp')
}

function optionalValue(value, fallback) {
  return value || fallback || ''
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 获取前端传递的用户信息
  const { userInfo = {}, userType } = event
  const normalizedPhone = normalizePhone(userInfo.phone)

  try {
    if (!openid) {
      return fail('AUTH_REQUIRED', '请先在微信小程序内登录')
    }

    // 查询是否已存在该用户：只信任云端 openid / miniOpenid，手机号需要验证后才能绑定
    const { user: existingUser, matchedBy } = await findExistingUser(openid)

    if (existingUser) {
      if (normalizedPhone && normalizedPhone !== (existingUser.phone || '')) {
        const phoneOwner = await findUserByPhone(normalizedPhone)
        if (phoneOwner && phoneOwner._id !== existingUser._id) {
          return fail('PHONE_LINK_REQUIRED', '该手机号已有关联用户，请先完成手机号验证后再绑定')
        }
      }

      // 用户已存在，返回现有信息
      // 更新用户信息（保持积分、经验值等数据）
      const updateData = {
        authSources: mergeAuthSources(existingUser),
        miniOpenid: existingUser.miniOpenid || openid,
        openid: existingUser.openid || openid,
        userType: existingUser.userType || userType,
        avatarUrl: optionalValue(userInfo.avatarUrl, existingUser.avatarUrl),
        nickName: optionalValue(userInfo.nickName, existingUser.nickName),
        name: optionalValue(userInfo.name, existingUser.name),
        gender: optionalValue(userInfo.gender, existingUser.gender),
        idCard: optionalValue(userInfo.idCard, existingUser.idCard),
        resume: optionalValue(userInfo.resume, existingUser.resume),
        emergencyPhone: optionalValue(userInfo.emergencyPhone, existingUser.emergencyPhone),
        runningLocation: optionalValue(userInfo.runningLocation, existingUser.runningLocation),
        runningYears: optionalValue(userInfo.runningYears, existingUser.runningYears),
        pace: optionalValue(userInfo.pace, existingUser.pace),
        hasMarathon: optionalValue(userInfo.hasMarathon, existingUser.hasMarathon),
        hasFirstAid: optionalValue(userInfo.hasFirstAid, existingUser.hasFirstAid),
        hasCompanionExp: optionalValue(userInfo.hasCompanionExp, existingUser.hasCompanionExp),
        lastLoginTime: new Date().toLocaleString(),
        updatedAt: db.serverDate()
      }
      if (normalizedPhone && existingUser.phone === normalizedPhone) {
        updateData.phone = normalizedPhone
      } else if (normalizedPhone) {
        updateData.pendingPhone = normalizedPhone
      }

      await db.collection('users').doc(existingUser._id).update({
        data: updateData
      })

      return {
        success: true,
        isNewUser: false,
        matchedBy,
        user: {
          ...existingUser,
          ...updateData
        }
      }
    } else {
      const phoneOwner = await findUserByPhone(normalizedPhone)
      if (phoneOwner) {
        return fail('PHONE_LINK_REQUIRED', '该手机号已有关联用户，请先完成手机号验证后再绑定')
      }

      // 新用户，创建记录
      const now = new Date()
      const newUser = {
        openid: openid,
        miniOpenid: openid,
        authSources: ['miniapp'],
        userType: userType, // 'disabled' 或 'volunteer'
        nickName: userInfo.nickName || '用户',
        avatarUrl: userInfo.avatarUrl || '',
        phone: '',
        pendingPhone: normalizedPhone || '',
        name: userInfo.name || '',
        gender: userInfo.gender || '',
        idCard: userInfo.idCard || '',
        resume: userInfo.resume || '',
        // 积分和经验值
        points: 0,
        exp: 0,
        checkInDays: 0,
        lastCheckInDate: '',
        // 段位信息（初始为第一级）
        tierLevel: 1,
        tierName: userType === 'volunteer' ? '启明之星' : '初心跑者',
        totalRuns: 0,
        totalDistance: 0,
        totalTime: 0,
        likes: 0,
        medals: 0,
        // 紧急联系人（仅视障人士）
        emergencyPhone: userInfo.emergencyPhone || '',
        emergencyName: '',
        emergencyRelation: '',
        // 视障人士专属
        runningLocation: userInfo.runningLocation || '',
        // 志愿者专属
        examPassed: userType === 'volunteer' ? false : null,
        examScore: 0,
        examDate: '',
        certificateNo: '',
        certificateUrl: '',
        videoWatched: false,
        isAvailable: false,
        runningYears: userInfo.runningYears || '',
        pace: userInfo.pace || '',
        hasMarathon: userInfo.hasMarathon || 'no',
        hasFirstAid: userInfo.hasFirstAid || 'no',
        hasCompanionExp: userInfo.hasCompanionExp || 'no',
        // 位置信息
        latitude: 0,
        longitude: 0,
        // 时间戳
        createdAt: now.toLocaleString(),
        lastLoginTime: now.toLocaleString(),
        updatedAt: db.serverDate()
      }

      const addRes = await db.collection('users').add({
        data: newUser
      })

      return {
        success: true,
        isNewUser: true,
        user: {
          _id: addRes._id,
          ...newUser
        }
      }
    }
  } catch (err) {
    console.error('syncUserInfo error:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
