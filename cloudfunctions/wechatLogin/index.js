// 云函数：微信登录验证
// 功能：通过微信登录凭证验证用户身份，判断是否新用户

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const code = event.code

  if (!openid) {
    return {
      success: false,
      error: '无法获取用户身份'
    }
  }

  try {
    // 查询云端用户数据
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()

    if (userRes.data.length > 0) {
      // 用户已存在，返回用户信息
      const userInfo = userRes.data[0]

      // 更新最后登录时间
      await db.collection('users').doc(userInfo._id).update({
        data: {
          lastLoginTime: new Date().toLocaleString()
        }
      })

      return {
        success: true,
        isNewUser: false,
        userType: userInfo.userType,
        userInfo: userInfo
      }
    } else {
      // 新用户，返回提示需要注册
      return {
        success: true,
        isNewUser: true,
        openid: openid,
        message: '请先填写完整信息完成注册'
      }
    }
  } catch (err) {
    console.error('微信登录验证失败:', err)
    return {
      success: false,
      error: err.message || '登录验证失败'
    }
  }
}
