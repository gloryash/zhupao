# 助盲跑平台 - 云开发后端部署指南

## 一、云开发环境准备

### 1. 开通云开发
1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入小程序管理后台
3. 找到「云开发」按钮，开通云开发
4. 创建环境，记录环境 ID（如 `blind-run-xxxx`）

### 2. 配置环境 ID
修改以下文件中的环境 ID：

**app.js**:
```javascript
wx.cloud.init({
  env: 'your-env-id',  // 替换为你的环境 ID
  traceUser: true
});
```

**project.config.json**:
```json
{
  "cloudfunctionRoot": "cloudfunctions/",
  "appid": "你的AppID"
}
```

---

## 二、部署云函数

### 1. 上传云函数
在微信开发者工具中，右键点击 `cloudfunctions` 文件夹，选择「上传并部署：云端安装依赖」

### 2. 涉及的云函数

| 云函数 | 功能 |
|--------|------|
| `syncUserInfo` | 用户登录同步，自动创建/更新用户 |
| `handleOrder` | 订单操作（发布、接单、取消、完成） |
| `updatePoints` | 积分管理（事务操作，确保原子性） |
| `initDB` | 初始化数据库集合和商品数据 |

### 3. 初始化数据库
首次部署后，需要调用一次 `initDB` 来创建集合：

可以在小程序控制台调用：
```javascript
// 在任意页面的 onLoad 中调用一次即可
wx.cloud.callFunction({
  name: 'initDB',
  success: res => console.log('数据库初始化成功', res),
  fail: err => console.error('初始化失败', err)
})
```

---

## 三、数据库集合设计

### 1. users (用户表)
```json
{
  "_id": "ObjectId",
  "_openid": "用户OpenID",
  "userType": "disabled | volunteer",
  "nickName": "微信昵称",
  "avatarUrl": "头像URL",
  "phone": "手机号",
  "name": "真实姓名",
  "points": 0,
  "exp": 0,
  "tierLevel": 1,
  "tierName": "段位名称",
  "totalRuns": 0,
  "totalDistance": 0,
  "totalTime": 0,
  "likes": 0,
  "medals": 0,
  "checkInDays": 0,
  "lastCheckInDate": "",
  "examPassed": false,
  "certificateUrl": "",
  "emergencyPhone": "",
  "createdAt": "Date",
  "lastLoginTime": "Date"
}
```

### 2. orders (订单表)
```json
{
  "_id": "ObjectId",
  "_openid": "盲人OpenID",
  "openid": "盲人OpenID",
  "userName": "盲人姓名",
  "userId": "盲人用户ID",
  "targetDistance": "目标距离",
  "estimatedDuration": "预计时间",
  "latitude": 31.2304,
  "longitude": 121.4737,
  "address": "地址描述",
  "volunteerOpenid": "",
  "volunteerName": "",
  "volunteerId": "",
  "volunteerPhone": "",
  "status": "waiting | accepted | arrived | running | completed | cancelled",
  "publishTime": "Date",
  "acceptTime": "",
  "startTime": "",
  "endTime": "",
  "volunteerLat": 0,
  "volunteerLng": 0,
  "actualDistance": "",
  "duration": 0,
  "rating": 0,
  "comment": "",
  "createdAt": "Date"
}
```

### 3. products (商品表)
```json
{
  "_id": "ObjectId",
  "name": "商品名称",
  "price": 100,
  "image": "🧋",
  "category": "food | equipment | honor | virtual",
  "stock": 100,
  "sold": 0,
  "desc": "商品描述",
  "limit": 1,
  "createdAt": "Date"
}
```

### 4. exchange_orders (兑换订单表)
```json
{
  "_id": "ObjectId",
  "_openid": "用户OpenID",
  "openid": "用户OpenID",
  "userId": "用户ID",
  "productId": "商品ID",
  "productName": "商品名称",
  "price": 100,
  "code": "EX123456",
  "status": "pending | completed | expired",
  "expiredTime": "Date",
  "createdAt": "Date"
}
```

### 5. moments (跑友圈表)
```json
{
  "_id": "ObjectId",
  "_openid": "用户OpenID",
  "content": "动态文字内容",
  "images": ["image1", "image2"],
  "authorName": "作者姓名",
  "authorAvatar": "头像URL",
  "likes": 0,
  "likedBy": ["openid1", "openid2"],
  "comments": [],
  "createdAt": "Date"
}
```

---

## 四、核心功能实现

### 1. 实时监听（Watch）
志愿者端监听新订单：

```javascript
// 在 onShow 中启动监听
onShow() {
  // 监听等待中的订单
  this.unwatch = app.watchAllOrders((snapshot) => {
    if (snapshot.docChanges.length > 0) {
      // 有新订单！
      wx.showToast({
        title: '有新的陪跑需求！',
        icon: 'none'
      });
      // 刷新订单列表
      this.loadOrders();
    }
  });
}

// 在 onHide 中取消监听
onHide() {
  if (this.unwatch) {
    this.unwatch();
  }
}
```

### 2. 事务操作（兑换商品）
云函数 `updatePoints` 中已实现事务：

```javascript
// 兑换商品时同时：
// 1. 扣除用户积分
// 2. 减少商品库存
// 3. 创建兑换订单
// 如果任一步骤失败，全部回滚
```

### 3. 权限校验
在云函数中已实现：

```javascript
// 只有发布者可以取消自己的订单
if (order.openid !== openid && order.volunteerOpenid !== openid) {
  return { error: '无权操作' };
}

// 只有接单志愿者可以完成订单
if (order.volunteerOpenid !== openid) {
  return { error: '只有接单志愿者可以完成' };
}
```

---

## 五、常见问题

### Q: 云函数部署失败？
A: 检查以下几点：
1. 微信开发者工具版本 >= 2.19.0
2. project.config.json 中配置了 cloudfunctionRoot
3. cloudfunction 文件夹没有中文路径

### Q: 数据库查询不到数据？
A: 检查权限设置，云开发默认所有用户可读自己创建的数据

### Q: 如何调试云函数？
A: 在微信开发者工具中，右键云函数 → 「查看云端日志」

---

## 六、生产环境注意事项

1. **环境隔离**：开发、测试、生产使用不同环境
2. **安全规则**：在云开发控制台设置数据库安全规则
3. **定时触发**：可设置定时任务清理过期兑换码
4. **监控告警**：开启云开发监控
