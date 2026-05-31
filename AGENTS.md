# 助盲跑小程序项目说明

这份文档用于让新的 AI 会话快速理解当前项目。项目代码是微信小程序 + 微信云开发，不是 Web/Vite/Next 应用。

## 项目是干什么的

`blind-run-miniapp` 是一个“助盲跑”微信小程序，目标是连接视障跑者和陪跑志愿者，让视障用户能够发布即时陪跑需求或预约陪跑服务，志愿者完成培训和考核后可以接单、导航、陪跑、记录轨迹，并获得积分、经验和段位成长。

核心用户角色：

- `disabled`：视障人士/视障跑者。
- `volunteer`：陪跑志愿者。

主要业务闭环：

1. 用户用手机号验证码或微信登录进入小程序，选择身份并填写资料。
2. 志愿者完成培训视频和考试，获得证书后才允许接单。
3. 视障用户发布即时陪跑需求、查找附近志愿者或创建预约。
4. 志愿者接单、到达、开始陪跑、实时同步位置和运动数据。
5. 订单完成后写入运动/陪跑记录，更新双方积分、经验、段位和统计。
6. 用户可以在跑友圈发动态、点赞评论，也可以用积分在商城兑换商品。

## 前后端架构

### 前端

前端是原生微信小程序：

- 全局入口：`app.js`
- 页面配置：`app.json`
- 全局样式：`app.wxss`
- 页面目录：`pages/*`
- 工具目录：`utils/*`
- 小程序项目配置：`project.config.json`

`app.json` 配置了 4 个 Tab：

- `pages/home/home`：首页。
- `pages/sport/sport`：运动。
- `pages/circle/circle`：跑友圈。
- `pages/mine/mine`：我的。

小程序开启了云开发：

- `app.json` 中 `"cloud": true`
- `app.js` 中 `wx.cloud.init({ env: 'cloudbase-4gujmrr46d949513', traceUser: true })`
- `project.config.json` 中 `cloudfunctionRoot` 指向 `./cloudfunctions`

前端主要调用方式是 `app.js` 封装的 `callCloudFunction(name, data)`，再通过语义化方法调用云函数，例如：

- `app.publishOrder()` / `app.acceptOrder()` / `app.completeOrder()`
- `app.getPosts()` / `app.createPost()`
- `app.saveSportRecord()` / `app.getCompanionRecords()`
- `app.getExamQuestions()` / `app.submitExam()` / `app.getCertificate()`
- `app.getAppointments()` / `app.createAppointment()`
- `app.getVolunteers()` / `app.getAvailableVolunteers()`
- `app.cloudCheckIn()` / `app.cloudExchange()`

`utils/request.js` 是 HTTP REST 请求封装，但当前主业务基本走微信云函数；`globalData.baseUrl/token` 未在 `app.js` 中正式配置，通常不要优先改这条路径，除非项目后续接入传统 HTTP 后端。

`utils/amap.js` 是地图工具封装，当前高德 Key 为空，默认只返回经纬度简化地址。实际定位主要使用微信 `wx.getLocation`，坐标系为 `gcj02`。

### 后端

后端是微信云开发云函数，位于 `cloudfunctions/*`，依赖统一是 `wx-server-sdk ~2.6.3`。

主要云函数：

- `syncUserInfo`：注册/登录时同步用户信息到 `users`。
- `wechatLogin`：微信登录验证并返回用户状态。
- `handleUser`：用户资料、紧急联系人、统计、位置更新。
- `handleOrder`：即时订单发布、接单、取消、完成、查询、状态更新、志愿者实时位置同步。
- `handleVolunteer`：志愿者列表、附近可用志愿者、接单状态、常联系人、志愿者详情。
- `handleSchedule`：预约创建、查询、取消、完成。
- `handleTraining`：培训题目、提交考试、证书生成和验证、视频观看状态。
- `handleRecord`：自主运动记录、陪跑记录、删除记录、今日统计。
- `handleCircle`：跑友圈动态、点赞、评论、删除。
- `handleShop`：商品列表和兑换订单查询。
- `updatePoints`：积分/经验更新、每日打卡、好评奖励、商城兑换事务。
- `initDB`：初始化集合、商品和考试题目。
- `testAll`：云函数接口测试辅助。

主要云数据库集合：

- `users`：用户资料、角色、积分、经验、段位、培训状态、位置。
- `orders`：即时陪跑订单，状态包括 `waiting`、`accepted`、`arrived`、`running`、`completed`、`cancelled`。
- `appointments`：预约单，状态包括 `pending`、`confirmed`、`cancelled`、`completed`。
- `sport_records`：自主运动记录和陪跑记录。
- `moments`：跑友圈动态。
- `comments`：跑友圈评论。
- `products`：积分商城商品。
- `exchange_orders`：积分兑换订单。
- `certificates`：志愿者证书。
- `exams`：培训考试题目。

### 数据策略

当前实现是“云端优先，本地降级”的混合模式：

- 很多页面先读 `wx.getStorageSync` 快速渲染，再异步调用云函数刷新。
- 云函数失败时，多个页面会退回到本地缓存或模拟数据。
- 本地缓存键包括 `userInfo_disabled`、`userInfo_volunteer`、`currentUserType`、`isLoggedIn`、`companion_records`、`sport_records`、`blind_orders`、`appointments`、`circle_posts`、`exchange_orders_*` 等。

修改业务时要注意前端本地缓存和云端集合可能同时存在同类数据，尤其是订单、预约、运动记录和培训状态。

## 目前实现的功能

### 登录和用户资料

- `pages/login/login`：手机号 + 模拟验证码登录，未注册用户跳转到资料页。
- `pages/quick-login/quick-login`：旧登录/二维码入口，目前 `onLoad` 会重定向到新登录页；内部仍保留微信登录、手机号登录和二维码逻辑。
- `pages/user-info/user-info`：按身份填写资料；视障人士需要紧急联系人和常用跑步地点，志愿者需要跑龄和配速等信息；提交后同步 `syncUserInfo`，失败时保留本地可用。
- `pages/change-password/change-password`：本地修改密码样式页面。
- `pages/emergency-contact/emergency-contact`：紧急联系人管理。

### 首页、我的和成长体系

- `pages/home/home`：展示用户信息、问候语、统计、积分、经验、段位；视障用户可每日打卡，志愿者可切换接单状态。
- `pages/mine/mine`：个人中心、任务流程、运动统计、入口导航。
- `app.js` 内置段位体系和积分规则：
  - 志愿者：完成陪跑 `+10` 积分、`+50` 经验；好评 `+20` 经验。
  - 视障用户：完成运动 `+30` 经验；每日打卡基础 `+5` 经验，连续三天额外奖励。

### 志愿者培训和证书

- `pages/training-flow/training-flow`：培训流程，包含视频学习、答题考试、领取证书三个步骤。
- `pages/exam/exam`：独立考试页，从云端题库加载题目，80 分及格。
- `pages/certificate/certificate`：展示志愿者证书和数字身份牌入口。
- `pages/certificate-verify/certificate-verify`：证书编号验证。
- `cloudfunctions/handleTraining`：提供题目、评分、证书生成、证书验证和培训状态查询。
- `cloudfunctions/initDB` 会初始化 10 道陪跑安全考试题目。

### 即时陪跑订单

- `pages/publish-need/publish-need`：视障用户点亮当前位置，发布即时陪跑需求；支持定位、目标里程/预计时间、志愿者接单提醒、震动提醒、紧急电话、投诉。
- `pages/take-order/take-order`：志愿者接单主流程；查询等待订单、接单、导航、确认到达、开始陪跑、实时轨迹追踪、结束陪跑、评价和保存记录。
- `pages/blind-order-track/blind-order-track`：视障用户查看订单状态、志愿者位置、实时跑步统计和轨迹。
- `pages/volunteer-order-track/volunteer-order-track`：本地预约/订单跟踪页，主要基于 `blind_orders` 本地缓存。
- `cloudfunctions/handleOrder`：云端订单的发布、接单、取消、完成、查询、状态更新、志愿者位置与跑步数据同步。

订单链路里有两套实现并存：

- 新云端订单：`orders` 集合 + `handleOrder`。
- 本地降级/演示订单：`blind_orders` 本地缓存。

修改订单相关逻辑时，需要确认目标页面走的是云端订单还是本地缓存订单。

### 预约和志愿者匹配

- `pages/appointment/appointment`：视障用户发布即时或预约订单；当前主要写入本地 `blind_orders`，附近志愿者部分带模拟数据。
- `pages/schedule/schedule`：日历式预约管理，云端读取 `appointments`，支持取消和完成预约。
- `pages/volunteer-list/volunteer-list`：选择志愿者并创建预约，优先调用 `handleSchedule.createAppointment`，失败后写本地缓存。
- `pages/appointment-square/appointment-square`：志愿者查看预约广场，当前主要读取本地 `blind_orders`。
- `pages/find-volunteers/find-volunteers`：视障用户查找附近正在接单的志愿者，优先调用 `handleVolunteer.getAvailableVolunteers`。
- `pages/frequently-contacted/frequently-contacted`：基于已完成订单统计常联系人。
- `cloudfunctions/handleVolunteer`：志愿者列表、可用志愿者、接单状态和常联系人。
- `cloudfunctions/handleSchedule`：预约的云端增删查和完成。

### 运动记录

- `pages/sport/sport`：运动页，视障用户进入预约/即时陪跑，志愿者陪跑进入接单页；自主跑/步行可开始记录，当前距离和卡路里是模拟计算，并保存本地和云端。
- `pages/records-manage/records-manage`：陪跑记录管理，支持搜索、查看详情、导出到剪贴板、删除、清空。
- `cloudfunctions/handleRecord`：保存/查询自主运动和陪跑记录、删除记录、今日统计。

### 跑友圈

- `pages/circle/circle`：动态列表、文字动态发布、运动打卡、点赞、评论；云端不可用时显示本地和模拟动态。
- `cloudfunctions/handleCircle`：动态列表、发布、点赞/取消点赞、评论、评论列表、删除动态。

### 积分商城

- `pages/shop/shop`：商品分类浏览、积分余额、兑换弹窗、兑换码展示。
- `pages/shop-orders/shop-orders`：兑换订单列表和兑换码查看。
- `cloudfunctions/handleShop`：商品和兑换订单查询。
- `cloudfunctions/updatePoints.exchange`：使用事务完成扣积分、减库存、创建兑换订单。
- `cloudfunctions/initDB` 初始化 18 个商品，分类包括 `food`、`equipment`、`honor`、`virtual`。

### 其他页面

- `pages/training-manage/training-manage`、`pages/training-course/training-course`、`pages/exam-edit/exam-edit`：培训管理/课程/题目编辑相关页面。
- `pages/tutorial/tutorial`：使用教程页面。
- `pages/shop-orders/shop-orders`：商城兑换记录。

## 当前实现注意点

- 代码库已有大量未提交修改，处理任务时不要随意回滚用户改动。
- 没有根目录 `package.json`；小程序应使用微信开发者工具打开，云函数依赖在各自 `cloudfunctions/*/package.json` 中。
- 多处仍有演示/降级逻辑，例如模拟验证码、模拟商品公告、模拟志愿者、模拟运动距离、`skipVideo` 和 `skipExam`。
- `pages/quick-login/quick-login` 现在加载后会重定向到 `pages/login/login`，但旧逻辑仍保留。
- 预约功能有云端 `appointments` 和本地 `blind_orders` 两套路径，页面之间不完全统一。
- 志愿者列表创建预约时要特别注意 `volunteerOpenid` 字段；前端映射里部分对象只有 `id`，不一定带 `openid`。
- `utils/request.js` 目前不像主链路，主链路是云函数，不要误以为项目已有传统 REST 后端。
- 地图 marker 中引用了 `/images/volunteer-marker.png`、`/images/blind-marker.png`、`/images/my-location.png` 等路径，但当前 `images` 目录主要是 tabbar 图标；若相关 marker 不显示，需要补资源或改为默认 marker。

## 常用开发入口

- 小程序页面清单：`app.json`
- 云开发环境和全局业务方法：`app.js`
- 部署说明：`CLOUD_DEPLOYMENT.md`
- 云函数入口：`cloudfunctions/*/index.js`
- 订单主链路：`pages/publish-need`、`pages/take-order`、`pages/blind-order-track`、`cloudfunctions/handleOrder`
- 志愿者培训：`pages/training-flow`、`pages/exam`、`pages/certificate`、`cloudfunctions/handleTraining`
- 预约链路：`pages/schedule`、`pages/volunteer-list`、`pages/appointment`、`cloudfunctions/handleSchedule`
