// 云函数：跑友圈相关操作
// 功能：发布动态、获取动态列表、点赞、评论

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
      case 'getPosts':
        return await getPosts(openid, event)
      case 'createPost':
        return await createPost(openid, event)
      case 'likePost':
        return await likePost(openid, event)
      case 'addComment':
        return await addComment(openid, event)
      case 'getComments':
        return await getComments(event)
      case 'deletePost':
        return await deletePost(openid, event)
      default:
        return { success: false, error: '未知操作' }
    }
  } catch (err) {
    console.error('handleCircle error:', err)
    return { success: false, error: err.message }
  }
}

// 获取动态列表
async function getPosts(openid, event) {
  const { page = 1, pageSize = 10 } = event

  const countRes = await db.collection('moments').count()
  const total = countRes.total

  const res = await db.collection('moments')
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  // 为每条动态标记当前用户是否已点赞
  const posts = res.data.map(post => ({
    ...post,
    isLiked: (post.likedBy || []).includes(openid),
    commentCount: (post.comments || []).length
  }))

  return {
    success: true,
    posts: posts,
    total: total,
    page: page,
    pageSize: pageSize
  }
}

// 发布动态
async function createPost(openid, event) {
  const { content, images } = event

  if (!content || !content.trim()) {
    return { success: false, error: '内容不能为空' }
  }

  // 获取用户信息
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }
  const user = userRes.data[0]

  const post = {
    openid: openid,
    authorName: user.nickName || user.name || '匿名用户',
    authorAvatar: user.avatarUrl || '',
    authorType: user.userType || '',
    content: content.trim(),
    images: images || [],
    likes: 0,
    likedBy: [],
    comments: [],
    createdAt: db.serverDate()
  }

  const addRes = await db.collection('moments').add({ data: post })

  return {
    success: true,
    postId: addRes._id,
    post: { _id: addRes._id, ...post }
  }
}

// 点赞/取消点赞
async function likePost(openid, event) {
  const { postId } = event

  const postRes = await db.collection('moments').doc(postId).get()
  if (!postRes.data) {
    return { success: false, error: '动态不存在' }
  }

  const likedBy = postRes.data.likedBy || []
  const isLiked = likedBy.includes(openid)

  if (isLiked) {
    // 取消点赞
    await db.collection('moments').doc(postId).update({
      data: {
        likes: _.inc(-1),
        likedBy: _.pull(openid)
      }
    })
    return { success: true, isLiked: false, likes: (postRes.data.likes || 1) - 1 }
  } else {
    // 点赞
    await db.collection('moments').doc(postId).update({
      data: {
        likes: _.inc(1),
        likedBy: _.push(openid)
      }
    })
    return { success: true, isLiked: true, likes: (postRes.data.likes || 0) + 1 }
  }
}

// 添加评论
async function addComment(openid, event) {
  const { postId, content } = event

  if (!content || !content.trim()) {
    return { success: false, error: '评论内容不能为空' }
  }

  // 获取用户信息
  const userRes = await db.collection('users').where({ openid: openid }).get()
  if (userRes.data.length === 0) {
    return { success: false, error: '用户不存在' }
  }
  const user = userRes.data[0]

  const comment = {
    openid: openid,
    authorName: user.nickName || user.name || '匿名用户',
    authorAvatar: user.avatarUrl || '',
    content: content.trim(),
    createdAt: new Date().toLocaleString()
  }

  // 同时存入 moments 的 comments 数组和独立的 comments 集合
  await db.collection('moments').doc(postId).update({
    data: {
      comments: _.push(comment)
    }
  })

  // 独立存储便于查询
  await db.collection('comments').add({
    data: {
      postId: postId,
      ...comment,
      createdAt: db.serverDate()
    }
  })

  return {
    success: true,
    comment: comment
  }
}

// 获取评论列表
async function getComments(event) {
  const { postId, page = 1, pageSize = 20 } = event

  const res = await db.collection('comments')
    .where({ postId: postId })
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get()

  return {
    success: true,
    comments: res.data
  }
}

// 删除动态（仅作者可删除）
async function deletePost(openid, event) {
  const { postId } = event

  const postRes = await db.collection('moments').doc(postId).get()
  if (!postRes.data) {
    return { success: false, error: '动态不存在' }
  }

  if (postRes.data.openid !== openid) {
    return { success: false, error: '无权删除此动态' }
  }

  await db.collection('moments').doc(postId).remove()

  // 删除相关评论
  await db.collection('comments').where({ postId: postId }).remove()

  return { success: true }
}
