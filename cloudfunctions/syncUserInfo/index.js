// 云函数：同步用户信息
// 功能：用户登录时自动检查数据库，有信息则返回，无信息则新增

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
const { normalizePhone } = require('./shared/user')

async function findExistingUser(openid, phone) {
  const openidRes = await db.collection('users').where({ openid }).limit(1).get()
  if (openidRes.data.length > 0) {
    return { user: openidRes.data[0], matchedBy: 'openid' }
  }

  const miniOpenidRes = await db.collection('users').where({ miniOpenid: openid }).limit(1).get()
  if (miniOpenidRes.data.length > 0) {
    return { user: miniOpenidRes.data[0], matchedBy: 'miniOpenid' }
  }

  if (phone) {
    const phoneRes = await db.collection('users').where({ phone }).limit(1).get()
    if (phoneRes.data.length > 0) {
      return { user: phoneRes.data[0], matchedBy: 'phone' }
    }
  }

  return { user: null, matchedBy: '' }
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
    // 查询是否已存在该用户：小程序 openid、历史 miniOpenid、手机号跨端合并
    const { user: existingUser, matchedBy } = await findExistingUser(openid, normalizedPhone)

    if (existingUser) {
      // 用户已存在，返回现有信息
      // 更新用户信息（保持积分、经验值等数据）
      const updateData = {
        authSources: mergeAuthSources(existingUser),
        miniOpenid: matchedBy === 'phone' ? openid : (existingUser.miniOpenid || openid),
        openid: existingUser.openid || openid,
        userType: userType || existingUser.userType,
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
      if (normalizedPhone) {
        updateData.phone = normalizedPhone
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
      // 新用户，创建记录
      const now = new Date()
      const newUser = {
        openid: openid,
        miniOpenid: openid,
        authSources: ['miniapp'],
        userType: userType, // 'disabled' 或 'volunteer'
        nickName: userInfo.nickName || '用户',
        avatarUrl: userInfo.avatarUrl || '',
        phone: normalizedPhone || '',
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
