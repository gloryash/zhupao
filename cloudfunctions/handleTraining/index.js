// 云函数：培训相关操作
// 功能：获取考试题目、提交考试、证书管理、视频观看记录

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
    if (action !== 'getExamQuestions' && action !== 'verifyCertificate') {
      const identity = await resolveIdentity(db, event)
      const authError = requireUser(identity)
      if (authError) return authError
      openid = identity.openid
    }

    switch (action) {
      case 'getExamQuestions':
        return await getExamQuestions()
      case 'submitExam':
        return await submitExam(openid, event)
      case 'getCertificate':
        return await getCertificate(openid)
      case 'verifyCertificate':
        return await verifyCertificate(event)
      case 'updateVideoWatched':
        return await updateVideoWatched(openid)
      case 'getTrainingStatus':
        return await getTrainingStatus(openid)
      default:
        return fail('VALIDATION_ERROR', '未知操作')
    }
  } catch (err) {
    console.error('handleTraining error:', err)
    return fail('INTERNAL_ERROR', err.message)
  }
}

// 获取考试题目
async function getExamQuestions() {
  const res = await db.collection('exams')
    .orderBy('order', 'asc')
    .get()

  // 返回题目时不包含答案（防作弊）
  const questions = res.data.map(q => ({
    _id: q._id,
    question: q.question,
    options: q.options,
    order: q.order
  }))

  return {
    success: true,
    questions: questions,
    total: questions.length,
    passScore: 80 // 80分及格
  }
}

// 提交考试
async function submitExam(openid, event) {
  const { answers } = event // answers: [{questionId, selectedIndex}]

  if (!answers || answers.length === 0) {
    return { success: false, error: '请完成所有题目' }
  }

  // 获取所有题目（含答案）
  const questionsRes = await db.collection('exams')
    .orderBy('order', 'asc')
    .get()

  const questions = questionsRes.data
  if (answers.length < questions.length) {
    return { success: false, error: '请完成所有题目' }
  }

  // 计算分数
  let correctCount = 0
  const results = []

  for (const answer of answers) {
    const question = questions.find(q => q._id === answer.questionId)
    if (question) {
      const isCorrect = question.answer === answer.selectedIndex
      if (isCorrect) correctCount++
      results.push({
        questionId: answer.questionId,
        isCorrect: isCorrect,
        correctAnswer: question.answer,
        explanation: question.explanation
      })
    }
  }

  const score = Math.round((correctCount / questions.length) * 100)
  const passed = score >= 80

  // 生成考试日期和证书编号
  const examDate = new Date().toLocaleDateString()
  let certificateNo = ''

  if (passed) {
    // 生成证书编号
    certificateNo = 'CERT' + Date.now().toString(36).toUpperCase() +
      Math.random().toString(36).substr(2, 4).toUpperCase()

    // 更新用户考试状态
    await db.collection('users').where({ openid: openid }).update({
      data: {
        examPassed: true,
        examScore: score,
        examDate: examDate,
        certificateNo: certificateNo,
        updatedAt: db.serverDate()
      }
    })

    // 保存证书记录
    await db.collection('certificates').add({
      data: {
        openid: openid,
        certificateNo: certificateNo,
        score: score,
        examDate: examDate,
        status: 'valid',
        createdAt: db.serverDate()
      }
    })
  }

  return {
    success: true,
    passed: passed,
    score: score,
    correctCount: correctCount,
    totalQuestions: questions.length,
    results: results,
    certificateNo: certificateNo,
    examDate: examDate
  }
}

// 获取证书信息
async function getCertificate(openid) {
  // 从用户信息获取
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }

  const user = userRes.data[0]
  if (!user.examPassed) {
    return { success: false, error: '尚未通过考试', examPassed: false }
  }

  return {
    success: true,
    certificate: {
      userName: user.nickName || user.name,
      certificateNo: user.certificateNo || '',
      score: user.examScore || 0,
      examDate: user.examDate || '',
      userType: user.userType
    }
  }
}

// 验证证书
async function verifyCertificate(event) {
  const { certificateNo } = event

  if (!certificateNo) {
    return { success: false, error: '请输入证书编号' }
  }

  const res = await db.collection('certificates')
    .where({ certificateNo: certificateNo })
    .get()

  if (res.data.length === 0) {
    return { success: false, error: '证书不存在', valid: false }
  }

  const cert = res.data[0]

  // 获取持证人信息
  const userRes = await db.collection('users')
    .where({ openid: cert.openid })
    .get()

  const userName = userRes.data.length > 0
    ? (userRes.data[0].nickName || userRes.data[0].name)
    : '未知用户'

  return {
    success: true,
    valid: cert.status === 'valid',
    certificate: {
      userName: userName,
      certificateNo: cert.certificateNo,
      score: cert.score,
      examDate: cert.examDate,
      status: cert.status
    }
  }
}

// 更新视频观看状态
async function updateVideoWatched(openid) {
  await db.collection('users').where({ openid: openid }).update({
    data: {
      videoWatched: true,
      updatedAt: db.serverDate()
    }
  })

  return { success: true }
}

// 获取培训状态
async function getTrainingStatus(openid) {
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }

  const user = userRes.data[0]

  return {
    success: true,
    status: {
      videoWatched: user.videoWatched || false,
      examPassed: user.examPassed || false,
      examScore: user.examScore || 0,
      examDate: user.examDate || '',
      certificateNo: user.certificateNo || ''
    }
  }
}
