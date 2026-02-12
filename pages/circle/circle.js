const app = getApp();

Page({
  data: {
    posts: [],
    currentUserType: '',
    showCommentsPopup: false,
    currentPost: null,
    currentPostIndex: -1,
    newCommentText: ''
  },

  onLoad() {
    this.loadPosts();
  },

  onShow() {
    this.loadPosts();
  },

  /**
   * 从云端加载动态帖子
   */
  loadPosts() {
    const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
    this.setData({ currentUserType });

    app.getPosts(1).then(res => {
      if (res.success && res.posts.length > 0) {
        const posts = res.posts.map(post => ({
          id: post._id,
          userName: post.authorName,
          userType: post.authorType || '',
          tier: '',
          tierIcon: '',
          content: post.content,
          images: post.images || [],
          date: post.createdAt ? new Date(post.createdAt).toLocaleString() : '',
          likes: post.likes || 0,
          comments: post.commentCount || 0,
          commentsList: (post.comments || []).map(c => ({
            id: c.openid + '_' + c.createdAt,
            userName: c.authorName,
            content: c.content,
            date: c.createdAt
          })),
          isLiked: post.isLiked || false
        }));
        this.setData({ posts: posts });
      } else {
        // 云端无数据时显示本地+模拟数据
        this._loadLocalPosts();
      }
    }).catch(() => {
      this._loadLocalPosts();
    });
  },

  /**
   * 本地降级加载（云端不可用时）
   */
  _loadLocalPosts() {
    const realPosts = wx.getStorageSync('circle_posts') || [];
    const allComments = wx.getStorageSync('circle_comments') || {};
    realPosts.forEach(post => {
      post.commentsList = allComments[post.id] || [];
      post.comments = post.commentsList.length;
    });
    const mockPosts = this._generateMockPosts();
    const allPosts = [...realPosts, ...mockPosts];
    allPosts.sort((a, b) => new Date(b.date) - new Date(a.date));
    this.setData({ posts: allPosts });
  },

  /**
   * 生成模拟数据（降级用）
   */
  _generateMockPosts() {
    const users = [
      { name: '张跑跑', type: 'volunteer', tier: '领跑天使', tierIcon: '👼' },
      { name: '李光明', type: 'disabled', tier: '疾风跑者', tierIcon: '💨' },
      { name: '王爱心', type: 'volunteer', tier: '烈阳守护', tierIcon: '☀️' }
    ];
    const activities = [
      '今天完成了5公里晨跑，感觉整个人都精神了！',
      '第一次参加陪跑活动，收获满满！',
      '坚持跑步第三十天，成功升级！'
    ];
    return users.map((user, index) => ({
      id: `mock_${index}`,
      userName: user.name,
      userType: user.type,
      tier: user.tier,
      tierIcon: user.tierIcon,
      content: activities[index % activities.length],
      date: new Date(Date.now() - index * 3600000 * 24).toLocaleString(),
      likes: Math.floor(Math.random() * 50),
      comments: 0,
      commentsList: [],
      isLiked: false
    }));
  },

  /**
   * 点赞（云端）
   */
  onLike(e) {
    const index = e.currentTarget.dataset.index;
    const posts = this.data.posts;
    const post = posts[index];

    // 模拟数据不支持云端点赞
    if (post.id.startsWith && post.id.startsWith('mock_')) {
      post.isLiked = !post.isLiked;
      post.likes = post.isLiked ? post.likes + 1 : post.likes - 1;
      this.setData({ posts });
      return;
    }

    // 云端点赞
    app.likePost(post.id).then(res => {
      if (res.success) {
        posts[index].isLiked = res.isLiked;
        posts[index].likes = res.likes;
        this.setData({ posts });
      }
    }).catch(() => {
      // 降级到本地
      post.isLiked = !post.isLiked;
      post.likes = post.isLiked ? post.likes + 1 : post.likes - 1;
      this.setData({ posts });
    });
  },

  /**
   * 送火炬祝福
   */
  onTorch(e) {
    const index = e.currentTarget.dataset.index;
    const post = this.data.posts[index];

    wx.showToast({
      title: '送出火炬祝福！',
      icon: 'success'
    });
  },

  /**
   * 发布动态
   */
  onPublish() {
    wx.showActionSheet({
      itemList: ['文字动态', '运动打卡'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.publishText();
        } else {
          this.publishCheckin();
        }
      }
    });
  },

  /**
   * 发布文字动态（云端）
   */
  publishText() {
    wx.showModal({
      title: '发布动态',
      editable: true,
      placeholderText: '分享你的运动心得...',
      success: (res) => {
        if (res.confirm && res.content.trim()) {
          wx.showLoading({ title: '发布中...' });
          app.createPost(res.content).then(result => {
            wx.hideLoading();
            if (result.success) {
              this.loadPosts();
              wx.showToast({ title: '发布成功', icon: 'success' });
            }
          }).catch(() => {
            wx.hideLoading();
            // 降级到本地
            const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
            const userInfo = wx.getStorageSync(`userInfo_${currentUserType}`);
            const tierInfo = app.calculateTier(currentUserType, 0);
            const newPost = {
              id: `post_${Date.now()}`,
              userName: (userInfo && userInfo.name) ? userInfo.name : '我',
              userType: currentUserType,
              tier: tierInfo.name,
              tierIcon: tierInfo.icon,
              content: res.content,
              date: new Date().toLocaleString(),
              likes: 0, comments: 0, isLiked: false
            };
            const posts = wx.getStorageSync('circle_posts') || [];
            posts.unshift(newPost);
            wx.setStorageSync('circle_posts', posts);
            this.loadPosts();
            wx.showToast({ title: '发布成功', icon: 'success' });
          });
        }
      }
    });
  },

  /**
   * 运动打卡
   */
  publishCheckin() {
    wx.showModal({
      title: '运动打卡',
      content: '今日已完成运动，是否打卡分享？',
      confirmText: '打卡',
      success: (res) => {
        if (res.confirm) {
          const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
          const userInfo = wx.getStorageSync(`userInfo_${currentUserType}`);
          const todayStats = wx.getStorageSync('today_stats') || {};

          const newPost = {
            id: `post_${Date.now()}`,
            userName: (userInfo && userInfo.name) ? userInfo.name : '我',
            userType: currentUserType,
            tier: app.calculateTier(currentUserType, 0).name,
            tierIcon: app.calculateTier(currentUserType, 0).icon,
            content: `今日运动打卡：${(todayStats.distance && todayStats.distance.toFixed(2)) || '0'} km，消耗 ${(todayStats.calories && todayStats.calories.toFixed(0)) || '0'} kCal`,
            date: new Date().toLocaleString(),
            likes: 0,
            comments: 0,
            isLiked: false,
            isCheckin: true
          };

          // 保存到本地存储
          const posts = wx.getStorageSync('circle_posts') || [];
          posts.unshift(newPost);
          wx.setStorageSync('circle_posts', posts);

          // 更新页面
          this.loadPosts();

          wx.showToast({
            title: '打卡成功',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 查看评论
   */
  onViewComments(e) {
    const index = e.currentTarget.dataset.index;
    const post = this.data.posts[index];

    this.setData({
      showCommentsPopup: true,
      currentPost: post,
      currentPostIndex: index,
      newCommentText: ''
    });
  },

  /**
   * 关闭评论弹窗
   */
  closeCommentsPopup() {
    this.setData({
      showCommentsPopup: false,
      currentPost: null,
      currentPostIndex: -1,
      newCommentText: ''
    });
  },

  /**
   * 输入评论
   */
  onCommentInput(e) {
    this.setData({
      newCommentText: e.detail.value
    });
  },

  /**
   * 发布评论（云端）
   */
  submitComment() {
    const { newCommentText, currentPost, currentPostIndex } = this.data;
    if (!newCommentText.trim()) {
      wx.showToast({ title: '请输入评论内容', icon: 'none' });
      return;
    }

    // 模拟数据降级到本地
    if (currentPost.id.startsWith && currentPost.id.startsWith('mock_')) {
      this._localSubmitComment();
      return;
    }

    app.addComment(currentPost.id, newCommentText.trim()).then(res => {
      if (res.success) {
        const posts = this.data.posts;
        const comment = res.comment;
        if (!posts[currentPostIndex].commentsList) {
          posts[currentPostIndex].commentsList = [];
        }
        posts[currentPostIndex].commentsList.unshift({
          id: 'c_' + Date.now(),
          userName: comment.authorName,
          content: comment.content,
          date: comment.createdAt
        });
        posts[currentPostIndex].comments = posts[currentPostIndex].commentsList.length;
        this.setData({ posts, newCommentText: '' });
        wx.showToast({ title: '评论成功', icon: 'success' });
      }
    }).catch(() => {
      this._localSubmitComment();
    });
  },

  /**
   * 本地评论降级
   */
  _localSubmitComment() {
    const { newCommentText, currentPost, currentPostIndex } = this.data;
    const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
    const userInfo = wx.getStorageSync(`userInfo_${currentUserType}`);

    const comment = {
      id: `comment_${Date.now()}`,
      userName: userInfo && userInfo.name ? userInfo.name : '我',
      content: newCommentText.trim(),
      date: new Date().toLocaleString()
    };

    const allComments = wx.getStorageSync('circle_comments') || {};
    if (!allComments[currentPost.id]) allComments[currentPost.id] = [];
    allComments[currentPost.id].unshift(comment);
    wx.setStorageSync('circle_comments', allComments);

    const posts = this.data.posts;
    posts[currentPostIndex].commentsList = allComments[currentPost.id] || [];
    posts[currentPostIndex].comments = posts[currentPostIndex].commentsList.length;
    this.setData({ posts, newCommentText: '' });
    wx.showToast({ title: '评论成功', icon: 'success' });
  },

  /**
   * 删除评论
   */
  deleteComment(e) {
    const commentIndex = e.currentTarget.dataset.commentIndex;
    const { currentPost, currentPostIndex } = this.data;

    wx.showModal({
      title: '确认删除',
      content: '确定删除这条评论吗？',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const allComments = wx.getStorageSync('circle_comments') || {};
          const comments = allComments[currentPost.id] || [];
          comments.splice(commentIndex, 1);
          allComments[currentPost.id] = comments;
          wx.setStorageSync('circle_comments', allComments);

          const posts = this.data.posts;
          posts[currentPostIndex].commentsList = comments;
          posts[currentPostIndex].comments = comments.length;

          if (!currentPost.id.startsWith('mock_')) {
            const realPosts = wx.getStorageSync('circle_posts') || [];
            const realPostIndex = realPosts.findIndex(p => p.id === currentPost.id);
            if (realPostIndex !== -1) {
              realPosts[realPostIndex].comments = posts[currentPostIndex].comments;
              wx.setStorageSync('circle_posts', realPosts);
            }
          }

          this.setData({ posts });
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  }
});
