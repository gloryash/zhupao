// 云函数：同步用户信息
// 功能：用户登录时自动检查数据库，有信息则返回，无信息则新增

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // 获取前端传递的用户信息
  const { userInfo, userType } = event

  try {
    // 查询是否已存在该用户
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()

    if (userRes.data.length > 0) {
      // 用户已存在，返回现有信息
      const existingUser = userRes.data[0]

      // 更新用户信息（保持积分、经验值等数据）
      const updateData = {
        avatarUrl: userInfo.avatarUrl || existingUser.avatarUrl,
        nickName: userInfo.nickName || existingUser.nickName,
        lastLoginTime: new Date().toLocaleString(),
        updatedAt: db.serverDate()
      }

      await db.collection('users').doc(existingUser._id).update({
        data: updateData
      })

      return {
        success: true,
        isNewUser: false,
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
        userType: userType, // 'disabled' 或 'volunteer'
        nickName: userInfo.nickName || '用户',
        avatarUrl: userInfo.avatarUrl || '',
        phone: userInfo.phone || '',
        name: userInfo.name || '',
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
        // 志愿者专属
        examPassed: userType === 'volunteer' ? false : null,
        certificateUrl: '',
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
