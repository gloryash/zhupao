// 云函数：商城相关操作
// 功能：获取商品列表、获取兑换订单

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
      case 'getProducts':
        return await getProducts(event)
      case 'getExchangeOrders':
        return await getExchangeOrders(openid, event)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('handleShop error:', err)
    return { success: false, error: err.message }
  }
}

// 获取商品列表
async function getProducts(event) {
  const { category, page = 1, pageSize = 20 } = event

  let query = db.collection('products')

  if (category && category !== 'all') {
    query = query.where({ category: category })
  }

  const countRes = await query.count()
  const total = countRes.total

  const res = await query
    .orderBy('createdAt', 'asc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    products: res.data,
    total: total,
    page: page,
    pageSize: pageSize
  }
}

// 获取用户兑换订单
async function getExchangeOrders(openid, event) {
  const { status, page = 1, pageSize = 20 } = event

  let whereCondition = { openid: openid }
  if (status && status !== 'all') {
    whereCondition.status = status
  }

  const countRes = await db.collection('exchange_orders')
    .where(whereCondition)
    .count()

  const res = await db.collection('exchange_orders')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  // 检查并更新过期订单
  const now = new Date()
  const orders = res.data.map(order => {
    if (order.status === 'pending' && order.expiredTime) {
      const expireDate = new Date(order.expiredTime)
      if (now > expireDate) {
        // 标记为过期（异步更新，不阻塞返回）
        db.collection('exchange_orders').doc(order._id).update({
          data: { status: 'expired' }
        }).catch(() => {})
        order.status = 'expired'
      }
    }
    return order
  })

  return {
    success: true,
    orders: orders,
    total: countRes.total,
    page: page,
    pageSize: pageSize
  }
}
