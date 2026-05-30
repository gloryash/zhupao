// 云函数：初始化数据库
// 功能：创建集合、添加初始商品数据、考试题目数据

const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 初始商品数据
const INITIAL_PRODUCTS = [
  // 能量补给
  { name: '奶茶券', price: 200, image: '🧋', category: 'food', stock: 50, sold: 23, desc: '任意门店兑换一杯奶茶', limit: 1 },
  { name: '咖啡券', price: 150, image: '☕', category: 'food', stock: 80, sold: 45, desc: '连锁咖啡店通用券', limit: 1 },
  { name: '运动饮料', price: 80, image: '🥤', category: 'food', stock: 100, sold: 67, desc: '补充电解质能量', limit: 5 },
  { name: '能量棒', price: 50, image: '🍫', category: 'food', stock: 200, sold: 156, desc: '跑步前后补充能量', limit: 10 },
  { name: '蛋白棒', price: 100, image: '🥨', category: 'food', stock: 150, sold: 89, desc: '高蛋白营养补给', limit: 5 },

  // 专业装备
  { name: '专业跑鞋', price: 2000, image: '👟', category: 'equipment', stock: 10, sold: 3, desc: '减震透气专业跑鞋', limit: 1 },
  { name: '护膝', price: 300, image: '🦵', category: 'equipment', stock: 30, sold: 12, desc: '保护膝盖关节', limit: 2 },
  { name: '运动手表', price: 1500, image: '⌚', category: 'equipment', stock: 5, sold: 1, desc: '心率监测GPS定位', limit: 1 },
  { name: '速干衣', price: 500, image: '👕', category: 'equipment', stock: 25, sold: 8, desc: '透气排汗速干面料', limit: 2 },
  { name: '空顶帽', price: 150, image: '🧢', category: 'equipment', stock: 60, sold: 34, desc: '防晒透气空顶帽', limit: 3 },

  // 荣誉周边
  { name: '助盲跑文化衫', price: 300, image: '👕', category: 'honor', stock: 100, sold: 56, desc: '彰显志愿者身份', limit: 3 },
  { name: '荣誉勋章', price: 500, image: '🏅', category: 'honor', stock: 50, sold: 23, desc: '收藏级纪念勋章', limit: 2 },
  { name: '段位徽章', price: 200, image: '⭐', category: 'honor', stock: 200, sold: 145, desc: '展示你的段位等级', limit: 5 },
  { name: '定制水壶', price: 250, image: '🫖', category: 'honor', stock: 40, sold: 18, desc: '刻有助盲跑logo', limit: 2 },

  // 虚拟权益
  { name: '专属头像框', price: 100, image: '🖼️', category: 'virtual', stock: 999, sold: 234, desc: '头像显示荣誉边框', limit: 1 },
  { name: '段位加速卡', price: 300, image: '🚀', category: 'virtual', stock: 100, sold: 45, desc: '下次陪跑双倍经验', limit: 3 },
  { name: '个性昵称', price: 150, image: '💬', category: 'virtual', stock: 500, sold: 178, desc: '特殊颜色昵称', limit: 1 },
  { name: '入场动画', price: 200, image: '✨', category: 'virtual', stock: 300, sold: 89, desc: '进入app时的特效', limit: 1 }
]

// 初始考试题目
const INITIAL_EXAMS = [
  {
    question: '陪跑时，志愿者应该站在视障跑者的哪一侧？',
    options: ['左侧', '右侧', '视障跑者习惯的一侧', '随意站位'],
    answer: 2,
    explanation: '应根据视障跑者的习惯和舒适度来决定站位，提前沟通确认。'
  },
  {
    question: '陪跑过程中，以下哪种沟通方式最合适？',
    options: ['大声喊叫提醒', '用简洁清晰的语言提前预告路况', '不需要沟通保持安静', '只在危险时才说话'],
    answer: 1,
    explanation: '陪跑时应用简洁清晰的语言提前预告前方路况，如"前方10米有台阶"。'
  },
  {
    question: '遇到紧急情况时，志愿者首先应该做什么？',
    options: ['立即拨打120', '先确保视障跑者安全停下', '大声呼救', '继续跑步观察情况'],
    answer: 1,
    explanation: '首要任务是确保视障跑者安全停下，然后再根据情况采取进一步措施。'
  },
  {
    question: '陪跑前的准备工作不包括以下哪项？',
    options: ['了解跑者的跑步习惯', '检查跑步路线安全性', '准备陪跑绳/带', '要求跑者提供医疗证明'],
    answer: 3,
    explanation: '陪跑前应了解跑者习惯、检查路线、准备装备，但不需要要求医疗证明。'
  },
  {
    question: '使用陪跑绳时，正确的握法是？',
    options: ['双方紧握不松手', '志愿者握紧，跑者轻握可随时松开', '双方都轻握', '不需要陪跑绳'],
    answer: 1,
    explanation: '志愿者应握紧陪跑绳，视障跑者轻握以便紧急情况下可以随时松开。'
  },
  {
    question: '陪跑过程中遇到下坡路段，应该怎么做？',
    options: ['加速冲下去', '提前告知并适当减速', '让跑者自己感受', '停下来走路'],
    answer: 1,
    explanation: '遇到下坡应提前告知视障跑者，并适当减速确保安全。'
  },
  {
    question: '以下哪种行为是陪跑志愿者应该避免的？',
    options: ['提前告知路况变化', '在跑步中途突然改变方向', '保持稳定的配速', '鼓励和支持跑者'],
    answer: 1,
    explanation: '突然改变方向会让视障跑者失去平衡，非常危险，应提前沟通。'
  },
  {
    question: '视障跑者表示身体不适时，志愿者应该？',
    options: ['鼓励继续坚持', '立即停止并询问具体情况', '减速但继续跑', '让跑者自己决定'],
    answer: 1,
    explanation: '应立即停止跑步，询问具体不适情况，必要时寻求医疗帮助。'
  },
  {
    question: '陪跑时的最佳配速应该是？',
    options: ['志愿者的正常配速', '视障跑者舒适的配速', '尽可能快', '固定5分钟/公里'],
    answer: 1,
    explanation: '应以视障跑者舒适的配速为准，陪跑的核心是安全和舒适。'
  },
  {
    question: '关于陪跑结束后，以下做法正确的是？',
    options: ['直接离开', '确认跑者安全到达休息区后再离开', '让跑者自己找路回去', '只说再见就走'],
    answer: 1,
    explanation: '陪跑结束后应确保视障跑者安全到达休息区或有人接应后再离开。'
  }
]

exports.main = async (event, context) => {
  try {
    // 所有需要的集合
    const collections = [
      'users', 'orders', 'products', 'exchange_orders', 'moments',
      'sport_records', 'appointments', 'certificates', 'exams',
      'comments', 'web_accounts', 'web_sessions'
    ]

    // 创建集合
    for (const name of collections) {
      try {
        await db.createCollection(name)
        console.log(`创建集合 ${name} 成功`)
      } catch (err) {
        if (err.errCode !== -501) { // -501 表示集合已存在
          console.error(`创建集合 ${name} 失败:`, err)
        } else {
          console.log(`集合 ${name} 已存在，跳过`)
        }
      }
    }

    // 添加初始商品数据（如果商品表为空）
    const productsRes = await db.collection('products').count()
    if (productsRes.total === 0) {
      // 云数据库批量添加限制20条，分批添加
      for (const product of INITIAL_PRODUCTS) {
        await db.collection('products').add({
          data: {
            ...product,
            createdAt: db.serverDate()
          }
        })
      }
      console.log('初始化商品数据成功')
    }

    // 添加初始考试题目（如果考试表为空）
    const examsRes = await db.collection('exams').count()
    if (examsRes.total === 0) {
      for (let i = 0; i < INITIAL_EXAMS.length; i++) {
        await db.collection('exams').add({
          data: {
            ...INITIAL_EXAMS[i],
            order: i + 1,
            createdAt: db.serverDate()
          }
        })
      }
      console.log('初始化考试题目成功')
    }

    return {
      success: true,
      action: 'initDB',
      message: '数据库初始化成功',
      collections: collections
    }
  } catch (err) {
    console.error('初始化数据库失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
