// 云函数：一键测试所有接口
// 用法：在微信开发者工具控制台调用 wx.cloud.callFunction({ name: 'testAll' })
// 会依次测试所有云函数的核心接口，返回测试报告

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  const results = []
  let testOrderId = ''
  let testAppointmentId = ''
  let testPostId = ''
  let testRecordId = ''

  // 辅助函数：记录测试结果
  function log(name, success, detail) {
    results.push({ name, success, detail: detail || '' })
    console.log(`[${success ? 'PASS' : 'FAIL'}] ${name}`, detail || '')
  }

  try {
    // ========== 1. 测试 syncUserInfo ==========
    try {
      const syncRes = await cloud.callFunction({
        name: 'syncUserInfo',
        data: {
          userInfo: {
            nickName: '测试用户',
            avatarUrl: '',
            phone: '13800000000',
            name: '测试',
            gender: 'male',
            runningYears: '3',
            pace: '6分/公里'
          },
          userType: 'volunteer'
        }
      })
      const r = syncRes.result
      log('syncUserInfo - 同步用户', r.success, r.isNewUser ? '新用户创建' : '已有用户更新')
    } catch (e) {
      log('syncUserInfo - 同步用户', false, e.message)
    }

    // ========== 2. 测试 wechatLogin ==========
    try {
      const loginRes = await cloud.callFunction({
        name: 'wechatLogin',
        data: {}
      })
      const r = loginRes.result
      log('wechatLogin - 登录验证', r.success, r.isNewUser ? '新用户' : `已有用户: ${r.userType}`)
    } catch (e) {
      log('wechatLogin - 登录验证', false, e.message)
    }

    // ========== 3. 测试 handleUser ==========
    // 3.1 获取用户信息
    try {
      const profileRes = await cloud.callFunction({
        name: 'handleUser',
        data: { action: 'getUserProfile' }
      })
      log('handleUser - getUserProfile', profileRes.result.success,
        profileRes.result.user ? `用户: ${profileRes.result.user.nickName}` : '')
    } catch (e) {
      log('handleUser - getUserProfile', false, e.message)
    }

    // 3.2 更新用户资料
    try {
      const updateRes = await cloud.callFunction({
        name: 'handleUser',
        data: { action: 'updateProfile', nickName: '测试用户_updated' }
      })
      log('handleUser - updateProfile', updateRes.result.success)
    } catch (e) {
      log('handleUser - updateProfile', false, e.message)
    }

    // 3.3 更新紧急联系人
    try {
      const emerRes = await cloud.callFunction({
        name: 'handleUser',
        data: {
          action: 'updateEmergencyContact',
          emergencyName: '测试联系人',
          emergencyPhone: '13900000000',
          emergencyRelation: '家人'
        }
      })
      log('handleUser - updateEmergencyContact', emerRes.result.success)
    } catch (e) {
      log('handleUser - updateEmergencyContact', false, e.message)
    }

    // 3.4 获取紧急联系人
    try {
      const getEmerRes = await cloud.callFunction({
        name: 'handleUser',
        data: { action: 'getEmergencyContact' }
      })
      log('handleUser - getEmergencyContact', getEmerRes.result.success,
        getEmerRes.result.emergencyContact ? `联系人: ${getEmerRes.result.emergencyContact.name}` : '')
    } catch (e) {
      log('handleUser - getEmergencyContact', false, e.message)
    }

    // 3.5 获取用户统计
    try {
      const statsRes = await cloud.callFunction({
        name: 'handleUser',
        data: { action: 'getUserStats' }
      })
      log('handleUser - getUserStats', statsRes.result.success,
        statsRes.result.stats ? `积分:${statsRes.result.stats.points} 经验:${statsRes.result.stats.exp}` : '')
    } catch (e) {
      log('handleUser - getUserStats', false, e.message)
    }

    // 3.6 更新位置
    try {
      const locRes = await cloud.callFunction({
        name: 'handleUser',
        data: { action: 'updateLocation', latitude: 31.2304, longitude: 121.4737 }
      })
      log('handleUser - updateLocation', locRes.result.success)
    } catch (e) {
      log('handleUser - updateLocation', false, e.message)
    }

    // ========== 4. 测试 handleOrder ==========
    // 4.1 发布订单
    try {
      const pubRes = await cloud.callFunction({
        name: 'handleOrder',
        data: {
          action: 'publish',
          targetDistance: '3',
          estimatedDuration: '30分钟',
          latitude: 31.2304,
          longitude: 121.4737,
          address: '测试地址'
        }
      })
      const r = pubRes.result
      if (r.success) {
        testOrderId = r.orderId
      }
      log('handleOrder - publish', r.success, r.orderId ? `订单ID: ${r.orderId}` : '')
    } catch (e) {
      log('handleOrder - publish', false, e.message)
    }

    // 4.2 获取等待中的订单
    try {
      const waitRes = await cloud.callFunction({
        name: 'handleOrder',
        data: { action: 'getWaitingOrders', page: 1 }
      })
      log('handleOrder - getWaitingOrders', waitRes.result.success,
        `共${waitRes.result.total || 0}条`)
    } catch (e) {
      log('handleOrder - getWaitingOrders', false, e.message)
    }

    // 4.3 获取我的订单
    try {
      const myRes = await cloud.callFunction({
        name: 'handleOrder',
        data: { action: 'getMyOrders', status: 'all', page: 1 }
      })
      log('handleOrder - getMyOrders', myRes.result.success,
        `共${myRes.result.total || 0}条`)
    } catch (e) {
      log('handleOrder - getMyOrders', false, e.message)
    }

    // 4.4 获取订单详情
    if (testOrderId) {
      try {
        const detailRes = await cloud.callFunction({
          name: 'handleOrder',
          data: { action: 'getOrderDetail', orderId: testOrderId }
        })
        log('handleOrder - getOrderDetail', detailRes.result.success,
          detailRes.result.order ? `状态: ${detailRes.result.order.status}` : '')
      } catch (e) {
        log('handleOrder - getOrderDetail', false, e.message)
      }
    }

    // 4.5 取消测试订单（清理）
    if (testOrderId) {
      try {
        const cancelRes = await cloud.callFunction({
          name: 'handleOrder',
          data: { action: 'cancel', orderId: testOrderId }
        })
        log('handleOrder - cancel', cancelRes.result.success)
      } catch (e) {
        log('handleOrder - cancel', false, e.message)
      }
    }

    // ========== 5. 测试 handleSchedule ==========
    // 5.1 创建预约
    try {
      const aptRes = await cloud.callFunction({
        name: 'handleSchedule',
        data: {
          action: 'createAppointment',
          volunteerOpenid: '',
          volunteerName: '测试志愿者',
          appointmentDate: '2099-01-01',
          appointmentTime: '08:00',
          address: '测试地点',
          note: '测试预约'
        }
      })
      const r = aptRes.result
      if (r.success) {
        testAppointmentId = r.appointmentId
      }
      log('handleSchedule - createAppointment', r.success, r.appointmentId ? `预约ID: ${r.appointmentId}` : '')
    } catch (e) {
      log('handleSchedule - createAppointment', false, e.message)
    }

    // 5.2 获取预约列表
    try {
      const listRes = await cloud.callFunction({
        name: 'handleSchedule',
        data: { action: 'getAppointments', status: 'all', page: 1 }
      })
      log('handleSchedule - getAppointments', listRes.result.success,
        `共${listRes.result.total || 0}条`)
    } catch (e) {
      log('handleSchedule - getAppointments', false, e.message)
    }

    // 5.3 按日期获取预约
    try {
      const dateRes = await cloud.callFunction({
        name: 'handleSchedule',
        data: { action: 'getAppointmentsByDate', date: '2099-01-01' }
      })
      log('handleSchedule - getAppointmentsByDate', dateRes.result.success,
        `共${(dateRes.result.appointments || []).length}条`)
    } catch (e) {
      log('handleSchedule - getAppointmentsByDate', false, e.message)
    }

    // 5.4 取消测试预约（清理）
    if (testAppointmentId) {
      try {
        const cancelRes = await cloud.callFunction({
          name: 'handleSchedule',
          data: { action: 'cancelAppointment', appointmentId: testAppointmentId }
        })
        log('handleSchedule - cancelAppointment', cancelRes.result.success)
      } catch (e) {
        log('handleSchedule - cancelAppointment', false, e.message)
      }
    }

    // ========== 6. 测试 handleRecord ==========
    // 6.1 保存运动记录
    try {
      const saveRes = await cloud.callFunction({
        name: 'handleRecord',
        data: {
          action: 'saveSportRecord',
          distance: 3.5,
          duration: 1800,
          calories: 250,
          pace: '8\'34"'
        }
      })
      const r = saveRes.result
      if (r.success) {
        testRecordId = r.recordId
      }
      log('handleRecord - saveSportRecord', r.success, r.recordId ? `记录ID: ${r.recordId}` : '')
    } catch (e) {
      log('handleRecord - saveSportRecord', false, e.message)
    }

    // 6.2 获取运动记录
    try {
      const getRes = await cloud.callFunction({
        name: 'handleRecord',
        data: { action: 'getSportRecords', page: 1 }
      })
      log('handleRecord - getSportRecords', getRes.result.success,
        `共${getRes.result.total || 0}条`)
    } catch (e) {
      log('handleRecord - getSportRecords', false, e.message)
    }

    // 6.3 保存陪跑记录
    try {
      const compRes = await cloud.callFunction({
        name: 'handleRecord',
        data: {
          action: 'saveCompanionRecord',
          partnerName: '测试伙伴',
          partnerType: 'disabled',
          distance: 2.0,
          duration: 1200,
          rating: 5,
          comment: '测试评价'
        }
      })
      log('handleRecord - saveCompanionRecord', compRes.result.success)
    } catch (e) {
      log('handleRecord - saveCompanionRecord', false, e.message)
    }

    // 6.4 获取陪跑记录
    try {
      const compListRes = await cloud.callFunction({
        name: 'handleRecord',
        data: { action: 'getCompanionRecords', page: 1 }
      })
      log('handleRecord - getCompanionRecords', compListRes.result.success,
        `共${compListRes.result.total || 0}条`)
    } catch (e) {
      log('handleRecord - getCompanionRecords', false, e.message)
    }

    // 6.5 获取今日统计
    try {
      const todayRes = await cloud.callFunction({
        name: 'handleRecord',
        data: { action: 'getTodayStats' }
      })
      log('handleRecord - getTodayStats', todayRes.result.success,
        todayRes.result.stats ? `今日跑步${todayRes.result.stats.runCount}次` : '')
    } catch (e) {
      log('handleRecord - getTodayStats', false, e.message)
    }

    // 6.6 删除测试记录（清理）
    if (testRecordId) {
      try {
        const delRes = await cloud.callFunction({
          name: 'handleRecord',
          data: { action: 'deleteRecords', recordIds: [testRecordId] }
        })
        log('handleRecord - deleteRecords', delRes.result.success,
          `删除${delRes.result.deleted || 0}条`)
      } catch (e) {
        log('handleRecord - deleteRecords', false, e.message)
      }
    }

    // ========== 7. 测试 handleTraining ==========
    // 7.1 获取培训状态
    try {
      const statusRes = await cloud.callFunction({
        name: 'handleTraining',
        data: { action: 'getTrainingStatus' }
      })
      log('handleTraining - getTrainingStatus', statusRes.result.success,
        statusRes.result.status ? `视频:${statusRes.result.status.videoWatched} 考试:${statusRes.result.status.examPassed}` : '')
    } catch (e) {
      log('handleTraining - getTrainingStatus', false, e.message)
    }

    // 7.2 获取考试题目
    try {
      const examRes = await cloud.callFunction({
        name: 'handleTraining',
        data: { action: 'getExamQuestions' }
      })
      log('handleTraining - getExamQuestions', examRes.result.success,
        `共${examRes.result.total || 0}题`)
    } catch (e) {
      log('handleTraining - getExamQuestions', false, e.message)
    }

    // 7.3 更新视频观看状态
    try {
      const videoRes = await cloud.callFunction({
        name: 'handleTraining',
        data: { action: 'updateVideoWatched' }
      })
      log('handleTraining - updateVideoWatched', videoRes.result.success)
    } catch (e) {
      log('handleTraining - updateVideoWatched', false, e.message)
    }

    // 7.4 获取证书
    try {
      const certRes = await cloud.callFunction({
        name: 'handleTraining',
        data: { action: 'getCertificate' }
      })
      // 可能未通过考试，所以 success=false 也是正常的
      log('handleTraining - getCertificate', true,
        certRes.result.success ? `证书: ${certRes.result.certificate.certificateNo}` : '尚未通过考试(正常)')
    } catch (e) {
      log('handleTraining - getCertificate', false, e.message)
    }

    // ========== 8. 测试 handleShop ==========
    // 8.1 获取商品列表
    try {
      const prodRes = await cloud.callFunction({
        name: 'handleShop',
        data: { action: 'getProducts', category: 'all' }
      })
      log('handleShop - getProducts', prodRes.result.success,
        `共${prodRes.result.total || 0}件商品`)
    } catch (e) {
      log('handleShop - getProducts', false, e.message)
    }

    // 8.2 按分类获取商品
    try {
      const foodRes = await cloud.callFunction({
        name: 'handleShop',
        data: { action: 'getProducts', category: 'food' }
      })
      log('handleShop - getProducts(food)', foodRes.result.success,
        `共${foodRes.result.total || 0}件`)
    } catch (e) {
      log('handleShop - getProducts(food)', false, e.message)
    }

    // 8.3 获取兑换订单
    try {
      const exchRes = await cloud.callFunction({
        name: 'handleShop',
        data: { action: 'getExchangeOrders', status: 'all' }
      })
      log('handleShop - getExchangeOrders', exchRes.result.success,
        `共${exchRes.result.total || 0}条`)
    } catch (e) {
      log('handleShop - getExchangeOrders', false, e.message)
    }

    // ========== 9. 测试 handleCircle ==========
    // 9.1 发布动态
    try {
      const postRes = await cloud.callFunction({
        name: 'handleCircle',
        data: { action: 'createPost', content: '这是一条测试动态，稍后会删除' }
      })
      const r = postRes.result
      if (r.success) {
        testPostId = r.postId
      }
      log('handleCircle - createPost', r.success, r.postId ? `动态ID: ${r.postId}` : '')
    } catch (e) {
      log('handleCircle - createPost', false, e.message)
    }

    // 9.2 获取动态列表
    try {
      const listRes = await cloud.callFunction({
        name: 'handleCircle',
        data: { action: 'getPosts', page: 1 }
      })
      log('handleCircle - getPosts', listRes.result.success,
        `共${listRes.result.total || 0}条`)
    } catch (e) {
      log('handleCircle - getPosts', false, e.message)
    }

    // 9.3 点赞
    if (testPostId) {
      try {
        const likeRes = await cloud.callFunction({
          name: 'handleCircle',
          data: { action: 'likePost', postId: testPostId }
        })
        log('handleCircle - likePost', likeRes.result.success,
          likeRes.result.isLiked ? '已点赞' : '已取消')
      } catch (e) {
        log('handleCircle - likePost', false, e.message)
      }
    }

    // 9.4 添加评论
    if (testPostId) {
      try {
        const commentRes = await cloud.callFunction({
          name: 'handleCircle',
          data: { action: 'addComment', postId: testPostId, content: '测试评论' }
        })
        log('handleCircle - addComment', commentRes.result.success)
      } catch (e) {
        log('handleCircle - addComment', false, e.message)
      }
    }

    // 9.5 获取评论
    if (testPostId) {
      try {
        const getComRes = await cloud.callFunction({
          name: 'handleCircle',
          data: { action: 'getComments', postId: testPostId }
        })
        log('handleCircle - getComments', getComRes.result.success,
          `共${(getComRes.result.comments || []).length}条`)
      } catch (e) {
        log('handleCircle - getComments', false, e.message)
      }
    }

    // 9.6 删除测试动态（清理）
    if (testPostId) {
      try {
        const delRes = await cloud.callFunction({
          name: 'handleCircle',
          data: { action: 'deletePost', postId: testPostId }
        })
        log('handleCircle - deletePost', delRes.result.success)
      } catch (e) {
        log('handleCircle - deletePost', false, e.message)
      }
    }

    // ========== 10. 测试 handleVolunteer ==========
    // 10.1 获取志愿者列表
    try {
      const volRes = await cloud.callFunction({
        name: 'handleVolunteer',
        data: { action: 'getVolunteers', page: 1 }
      })
      log('handleVolunteer - getVolunteers', volRes.result.success,
        `共${volRes.result.total || 0}位志愿者`)
    } catch (e) {
      log('handleVolunteer - getVolunteers', false, e.message)
    }

    // 10.2 更新可用状态
    try {
      const availRes = await cloud.callFunction({
        name: 'handleVolunteer',
        data: {
          action: 'updateAvailability',
          isAvailable: true,
          latitude: 31.2304,
          longitude: 121.4737
        }
      })
      log('handleVolunteer - updateAvailability', availRes.result.success)
    } catch (e) {
      log('handleVolunteer - updateAvailability', false, e.message)
    }

    // 10.3 获取可用志愿者
    try {
      const nearRes = await cloud.callFunction({
        name: 'handleVolunteer',
        data: {
          action: 'getAvailableVolunteers',
          latitude: 31.2304,
          longitude: 121.4737,
          radius: 50000
        }
      })
      log('handleVolunteer - getAvailableVolunteers', nearRes.result.success,
        `附近${nearRes.result.total || 0}位`)
    } catch (e) {
      log('handleVolunteer - getAvailableVolunteers', false, e.message)
    }

    // 10.4 获取常联系人
    try {
      const freqRes = await cloud.callFunction({
        name: 'handleVolunteer',
        data: { action: 'getFrequentContacts', limit: 5 }
      })
      log('handleVolunteer - getFrequentContacts', freqRes.result.success,
        `共${freqRes.result.total || 0}位`)
    } catch (e) {
      log('handleVolunteer - getFrequentContacts', false, e.message)
    }

    // 10.5 关闭可用状态（清理）
    try {
      await cloud.callFunction({
        name: 'handleVolunteer',
        data: { action: 'updateAvailability', isAvailable: false }
      })
    } catch (e) {}

    // ========== 11. 测试 updatePoints ==========
    // 11.1 每日打卡
    try {
      const checkInRes = await cloud.callFunction({
        name: 'updatePoints',
        data: { action: 'checkIn' }
      })
      const r = checkInRes.result
      log('updatePoints - checkIn', r.success || r.error === '今日已打卡',
        r.success ? `${r.message}` : r.error)
    } catch (e) {
      log('updatePoints - checkIn', false, e.message)
    }

  } catch (e) {
    log('全局异常', false, e.message)
  }

  // 生成测试报告
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const total = results.length

  console.log('\n========== 测试报告 ==========')
  console.log(`总计: ${total} | 通过: ${passed} | 失败: ${failed}`)
  console.log('==============================\n')

  if (failed > 0) {
    console.log('失败的测试:')
    results.filter(r => !r.success).forEach(r => {
      console.log(`  ✗ ${r.name}: ${r.detail}`)
    })
  }

  return {
    success: true,
    summary: {
      total,
      passed,
      failed,
      passRate: `${Math.round(passed / total * 100)}%`
    },
    results: results
  }
}
