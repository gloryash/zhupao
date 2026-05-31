# 助盲跑小程序 产品需求文档（PRD）

| 项目 | 内容 |
|------|------|
| 产品名称 | 助盲跑（助盲跑步陪伴平台） |
| 产品形态 | 微信小程序 + 微信云开发（Serverless） |
| 文档版本 | v1.0 |
| 文档日期 | 2026-05-30 |
| 文档来源 | 基于现有代码库（`blind-run-miniapp`）逆向整理 |

---

## 1. 产品概述

### 1.1 产品定位

助盲跑是一个公益属性的微信小程序，目标是**连接视障跑者（视障人士）与陪跑志愿者**，让视障用户能够安全、便捷地参与跑步运动。平台通过「即时陪跑接单 + 预约陪跑 + 志愿者培训认证 + 运动记录 + 成长激励 + 社区互动」的完整闭环，降低视障人士参与户外运动的门槛，同时为志愿者提供规范的服务与成长体系。

### 1.2 目标用户（角色）

| 角色 | 标识 | 描述 | 核心诉求 |
|------|------|------|---------|
| 视障跑者 | `disabled` | 视力障碍人士 | 安全地找到陪跑伙伴、记录运动、紧急求助 |
| 陪跑志愿者 | `volunteer` | 经过培训认证的爱心志愿者 | 接单陪跑、获得认证与成长、积分激励 |

### 1.3 核心业务闭环

1. 用户通过手机号验证码或微信登录，选择身份并完善资料。
2. 志愿者完成培训视频学习与在线考试，获得电子证书后方可接单。
3. 视障用户发布即时陪跑需求 / 查找附近志愿者 / 创建预约。
4. 志愿者接单 → 导航前往 → 确认到达 → 开始陪跑 → 实时同步位置与运动数据 → 结束陪跑。
5. 订单完成后写入运动/陪跑记录，更新双方积分、经验、段位与统计。
6. 用户在跑友圈发布动态、点赞评论，并用积分在商城兑换商品。

### 1.4 技术架构概览

- **前端**：原生微信小程序（非 Web/Vite/Next）。入口 `app.js`，页面配置 `app.json`，全局样式 `app.wxss`。
- **后端**：微信云开发云函数（`cloudfunctions/*`），统一依赖 `wx-server-sdk`。
- **数据库**：微信云开发数据库（文档型），核心集合见第 6 章。
- **定位**：主用微信 `wx.getLocation`（坐标系 `gcj02`）；`utils/amap.js` 为高德地图封装（当前 Key 为空，降级返回经纬度简化地址）。
- **数据策略**：**云端优先、本地降级**的混合模式。页面常先读 `wx.getStorageSync` 快速渲染，再异步调用云函数刷新；云函数失败时退回本地缓存或模拟数据。

---

## 2. 信息架构与导航

### 2.1 底部 Tab（4 个主入口）

| Tab | 页面 | 说明 |
|-----|------|------|
| 首页 | `pages/home/home` | 用户信息、统计、积分经验、段位、打卡/接单状态 |
| 运动 | `pages/sport/sport` | 运动入口（陪跑 / 自主跑 / 步行） |
| 跑友圈 | `pages/circle/circle` | 社区动态、点赞、评论 |
| 我的 | `pages/mine/mine` | 个人中心、任务流程、统计、各功能入口 |

### 2.2 全局主题

- 主色：橙色 `#FF6B00`（导航栏背景、Tab 选中色）。
- 导航栏标题：助盲跑。
- 权限：`scope.userLocation`（用于查找附近陪跑志愿者）；声明后台定位 `requiredBackgroundModes: location`。

---

## 3. 功能需求详述

### 3.1 登录与账号

| 页面 | 功能 |
|------|------|
| `pages/login/login` | 手机号 + 验证码登录（当前为模拟验证码）；未注册用户跳转资料页 |
| `pages/quick-login/quick-login` | 旧登录/二维码入口；`onLoad` 重定向到新登录页，内部仍保留微信登录、手机号登录、二维码逻辑 |
| `pages/user-info/user-info` | 按身份完善资料；提交后通过 `syncUserInfo` 同步云端，失败保留本地 |
| `pages/change-password/change-password` | 本地修改密码页 |

**资料字段差异**：
- 视障人士：紧急联系人、常用跑步地点等。
- 志愿者：跑龄、配速等。

**登录态管理（`app.js`）**：
- 本地缓存键：`isLoggedIn`、`isRegistered`、`currentUserType`、`userInfo_{type}`、`isRegistered_{type}`。
- `onShow` 时检查登录态：未登录跳 `login`，已登录跳 `home`。
- 支持扫码进入（`scene` 参数解析 `user_qr` token 匹配用户登录）。

**需求点**：
- [REQ] 支持两种身份注册与切换。
- [REQ] 登录态持久化与自动跳转。
- [REQ] 二维码身份牌扫码登录（志愿者数字身份牌）。

### 3.2 首页与成长体系

**页面**：`pages/home/home`、`pages/mine/mine`

| 功能 | 说明 |
|------|------|
| 用户信息展示 | 头像、昵称、问候语、身份 |
| 统计展示 | 累计次数、距离、时长、点赞、勋章 |
| 积分 / 经验 / 段位 | 当前积分、经验值、段位名称与进度 |
| 每日打卡 | 视障用户专属，连续打卡有额外奖励 |
| 接单状态切换 | 志愿者专属，切换「是否接单」可用状态 |

**段位体系（`app.js` `TIER_SYSTEM`）**：

| 等级 | 志愿者段位 | 视障跑者段位 | 解锁条件（累计次数） |
|------|-----------|-------------|--------------------|
| 1 | 🌟 启明之星 | 🎯 初心跑者 | 0 |
| 2 | 🌅 破晓勇士 | 💨 疾风跑者 | 5 |
| 3 | ☀️ 烈阳守护 | ⚡ 极速护卫 | 15 |
| 4 | 👼 领跑天使 | 🌟 光明统帅 | 30 |

**积分与经验规则（`app.js` `POINTS_SYSTEM`）**：

| 角色 | 行为 | 奖励 |
|------|------|------|
| 志愿者 | 完成一次陪跑 | +10 积分，+50 经验 |
| 志愿者 | 获得好评 | +20 经验 |
| 视障用户 | 完成一次运动 | +30 经验 |
| 视障用户 | 每日打卡 | 基础 +5 经验 |
| 视障用户 | 连续打卡满 3 天 | 额外 +50 经验（达成后重置连续天数） |

**需求点**：
- [REQ] 段位根据累计陪跑/跑步次数自动计算，含下一级进度百分比。
- [REQ] 积分可消费（商城兑换），经验只增不减用于段位成长。
- [REQ] 打卡逻辑需识别「今日已打卡 / 连续 / 中断重置」三种状态。

### 3.3 志愿者培训与认证

**页面**：`training-flow`、`exam`、`exam-edit`、`certificate`、`certificate-verify`、`training-manage`、`training-course`
**云函数**：`handleTraining`、`initDB`

| 步骤 | 页面 | 说明 |
|------|------|------|
| 1. 视频学习 | `training-flow`（步骤1） | 观看培训视频，记录观看状态（`updateVideoWatched`） |
| 2. 在线考试 | `training-flow`（步骤2）/ `exam` | 从云端题库加载题目，**80 分及格** |
| 3. 领取证书 | `training-flow`（步骤3）/ `certificate` | 通过后生成电子证书与数字身份牌 |
| 证书验证 | `certificate-verify` | 输入证书编号验证真伪 |

**培训题库**：`initDB` 初始化 **10 道陪跑安全考试题目**。

**业务规则**：
- [REQ] **志愿者必须完成培训 + 考试通过才能接单**（前置门槛）。
- [REQ] 考试评分由云端完成（`submitExam`），返回得分与是否及格。
- [REQ] 证书含唯一编号，支持第三方扫码/输入验证。
- [REQ] 培训状态可查询（`getTrainingStatus`），含视频观看、考试通过、证书状态。
- 演示能力：当前保留 `skipVideo`、`skipExam` 等降级开关。

### 3.4 即时陪跑订单（核心链路）

**页面**：`publish-need`、`take-order`、`blind-order-track`、`volunteer-order-track`
**云函数**：`handleOrder`

#### 订单状态机

```
waiting（等待接单）→ accepted（已接单）→ arrived（志愿者到达）
   → running（陪跑中）→ completed（已完成）
   （任意非完成状态可 → cancelled 取消）
```

#### 视障用户侧 — 发布需求（`publish-need`）

- 点亮当前位置（定位），发布即时陪跑需求。
- 支持设置目标里程 / 预计时间。
- 志愿者接单提醒、震动提醒。
- 紧急电话、投诉入口。

#### 视障用户侧 — 订单追踪（`blind-order-track`）

- 查看订单状态、志愿者实时位置。
- 实时跑步统计（距离、时长）与轨迹展示。

#### 志愿者侧 — 接单主流程（`take-order`）

1. 查询等待中订单（`getWaitingOrders`，可按位置）。
2. 接单（`accept`）。
3. 导航前往视障用户位置。
4. 确认到达（`arrived`）。
5. 开始陪跑（`running`）。
6. 实时上报位置与跑步数据（`updateVolunteerLocation`，含 `runningStats`、`runningPath`）。
7. 结束陪跑 → 完成订单（`complete`）。
8. 评价并保存陪跑记录。

#### 实时能力

- `app.watchAllOrders`：志愿者端监听 `status: waiting` 的新订单，实时弹出提醒。
- `app.watchOrderStatus`：监听当前用户订单状态变化。

#### 权限校验（云端）

- 仅发布者或接单志愿者可取消订单。
- 仅接单志愿者可完成订单。

**注意（并存的两套实现）**：
- 云端订单：`orders` 集合 + `handleOrder`。
- 本地降级/演示订单：`blind_orders` 本地缓存（`volunteer-order-track`、`appointment` 等）。

**需求点**：
- [REQ] 全流程状态可追踪，双方均可实时查看对方位置/进度。
- [REQ] 完成订单后自动计入双方统计、积分、经验。
- [REQ] 提供紧急求助（一键拨打紧急联系人）与投诉入口。

### 3.5 预约陪跑与志愿者匹配

**页面**：`appointment`、`appointment-square`、`schedule`、`volunteer-list`、`find-volunteers`、`frequently-contacted`
**云函数**：`handleSchedule`、`handleVolunteer`

#### 预约状态机

```
pending（待确认）→ confirmed（已确认）→ completed（已完成）
   （可 → cancelled 取消）
```

| 页面 | 角色 | 功能 |
|------|------|------|
| `appointment` | 视障 | 发布即时或预约订单（当前主写本地 `blind_orders`，附近志愿者带模拟数据） |
| `volunteer-list` | 视障 | 选择志愿者并创建预约，优先 `handleSchedule.createAppointment`，失败写本地缓存 |
| `find-volunteers` | 视障 | 查找附近正在接单的志愿者，优先 `getAvailableVolunteers`（按经纬度 + 半径） |
| `schedule` | 双方 | 日历式预约管理，云端读取 `appointments`，支持取消、完成 |
| `appointment-square` | 志愿者 | 预约广场（当前主读本地 `blind_orders`） |
| `frequently-contacted` | 双方 | 基于已完成订单统计常联系人 |

**需求点**：
- [REQ] 视障用户可指定具体志愿者或开放抢约。
- [REQ] 日历视图按日期查看/管理预约（`getAppointmentsByDate`）。
- [REQ] 附近可用志愿者按距离匹配（默认半径 5000m）。
- [REQ] 常联系人快速复约。
- 已知技术债：预约存在云端 `appointments` 与本地 `blind_orders` 两套路径，页面间未完全统一；`volunteerOpenid` 字段映射需注意。

### 3.6 运动记录

**页面**：`sport`、`records-manage`
**云函数**：`handleRecord`

| 功能 | 说明 |
|------|------|
| 运动入口（`sport`） | 视障用户进入预约/即时陪跑；志愿者进入接单；自主跑/步行可开始记录 |
| 自主运动记录 | 距离、卡路里当前为模拟计算，保存本地 + 云端 |
| 陪跑记录管理（`records-manage`） | 搜索、查看详情、导出到剪贴板、删除、清空 |
| 今日统计 | `getTodayStats` 返回当日运动汇总 |

**记录类型**：
- 自主运动记录（`saveSportRecord` / `getSportRecords`）。
- 陪跑记录（`saveCompanionRecord` / `getCompanionRecords`）。

**需求点**：
- [REQ] 区分自主运动与陪跑两类记录。
- [REQ] 记录可按日期/关键字检索、导出、删除。
- [TODO] 距离/卡路里目前为模拟值，后续应接入真实 GPS 轨迹计算。

### 3.7 跑友圈（社区）

**页面**：`circle`
**云函数**：`handleCircle`

| 功能 | 说明 |
|------|------|
| 动态列表 | 分页加载（`getPosts`），云端不可用时显示本地+模拟动态 |
| 发布动态 | 文字动态、运动打卡（`createPost`，支持图片） |
| 点赞 | 点赞/取消点赞（`likePost`） |
| 评论 | 发表评论、查看评论列表（`addComment` / `getComments`） |
| 删除 | 删除本人动态（`deletePost`） |

**需求点**：
- [REQ] 支持图文动态与运动成果打卡分享。
- [REQ] 点赞数同步至用户统计（`likes`）。

### 3.8 积分商城

**页面**：`shop`、`shop-orders`
**云函数**：`handleShop`、`updatePoints`、`initDB`

| 功能 | 说明 |
|------|------|
| 商品浏览（`shop`） | 分类浏览、积分余额展示、兑换弹窗、兑换码展示 |
| 兑换订单（`shop-orders`） | 兑换记录列表、兑换码查看 |
| 兑换事务 | `updatePoints.exchange` 使用**事务**：扣积分 + 减库存 + 创建兑换订单，任一失败全部回滚 |

**商品数据**：`initDB` 初始化 **18 个商品**，分类：`food`（食品）、`equipment`（装备）、`honor`（荣誉）、`virtual`（虚拟）。

**兑换订单状态**：`pending`（待使用）/ `completed`（已使用）/ `expired`（已过期），含唯一兑换码与过期时间。

**需求点**：
- [REQ] 积分兑换必须保证原子性（事务）。
- [REQ] 商品有库存与限购（`limit`）控制。
- [TODO] 可设定时任务清理过期兑换码。

### 3.9 紧急联系人与安全

**页面**：`emergency-contact`、`frequently-contacted`
**云函数**：`handleUser`

- 视障用户维护紧急联系人（`updateEmergencyContact` / `getEmergencyContact`）。
- 订单流程中提供紧急电话拨打入口。

**需求点**：
- [REQ] 视障用户注册时建议绑定紧急联系人。
- [REQ] 陪跑过程中一键紧急求助。

### 3.10 其他

| 页面 | 说明 |
|------|------|
| `tutorial` | 使用教程页 |
| `training-manage` / `training-course` / `exam-edit` | 培训管理 / 课程 / 题目编辑 |

---

## 4. 云函数（后端接口）清单

| 云函数 | 主要 action / 职责 |
|--------|-------------------|
| `syncUserInfo` | 注册/登录时同步用户到 `users` |
| `wechatLogin` | 微信登录验证并返回用户状态 |
| `handleUser` | `getUserProfile` / `updateProfile` / `updateEmergencyContact` / `getEmergencyContact` / `getUserStats` / `updateLocation` |
| `handleOrder` | `publish` / `accept` / `cancel` / `complete` / `getMyOrders` / `getWaitingOrders` / `getOrderDetail` / `updateVolunteerLocation` / `updateOrderStatus` |
| `handleVolunteer` | `getVolunteers` / `getAvailableVolunteers` / `updateAvailability` / `getFrequentContacts` / `getVolunteerDetail` |
| `handleSchedule` | `getAppointments` / `createAppointment` / `cancelAppointment` / `getAppointmentsByDate` / `completeAppointment` |
| `handleTraining` | `getExamQuestions` / `submitExam` / `getCertificate` / `verifyCertificate` / `updateVideoWatched` / `getTrainingStatus` |
| `handleRecord` | `saveSportRecord` / `getSportRecords` / `saveCompanionRecord` / `getCompanionRecords` / `deleteRecords` / `getTodayStats` |
| `handleCircle` | `getPosts` / `createPost` / `likePost` / `addComment` / `getComments` / `deletePost` |
| `handleShop` | `getProducts` / `getExchangeOrders` |
| `updatePoints` | `checkIn` / `exchange`（事务）/ `feedback` |
| `initDB` | 初始化集合、18 商品、10 考试题目 |
| `testAll` | 云函数接口测试辅助 |

调用统一通过 `app.callCloudFunction(name, data)` 封装，再由语义化方法（如 `app.publishOrder()`、`app.acceptOrder()`）发起。

---

## 5. 数据库集合设计

| 集合 | 说明 | 关键字段 |
|------|------|---------|
| `users` | 用户资料 | `userType`、`points`、`exp`、`tierLevel`、`totalRuns`、`totalDistance`、`totalTime`、`examPassed`、`certificateUrl`、`emergencyPhone`、`checkInDays` |
| `orders` | 即时陪跑订单 | `status`、`openid`、`volunteerOpenid`、`latitude/longitude`、`targetDistance`、`volunteerLat/Lng`、`rating` |
| `appointments` | 预约单 | `status`（pending/confirmed/cancelled/completed） |
| `sport_records` | 自主运动 + 陪跑记录 | 距离、时长、卡路里、类型 |
| `moments` | 跑友圈动态 | `content`、`images`、`likes`、`likedBy`、`comments` |
| `comments` | 动态评论 | `postId`、`content` |
| `products` | 商城商品 | `price`、`category`、`stock`、`sold`、`limit` |
| `exchange_orders` | 兑换订单 | `code`、`status`、`expiredTime` |
| `certificates` | 志愿者证书 | 证书编号、持有人 |
| `exams` | 培训考试题目 | 题目、选项、答案 |

详细字段定义见 `CLOUD_DEPLOYMENT.md` 第三章。

---

## 6. 关键业务规则汇总

1. **接单门槛**：志愿者必须完成培训视频 + 考试通过（≥80 分）+ 领取证书，方可接单。
2. **段位成长**：基于累计陪跑/运动次数，4 级段位（0/5/15/30 次解锁）。
3. **积分获取**：志愿者完成陪跑 +10 积分；视障用户通过经验与打卡成长。
4. **积分消费**：仅用于商城兑换，兑换走事务保证原子性。
5. **订单权限**：仅相关当事人可取消/完成订单。
6. **实时同步**：志愿者位置与跑步数据实时上报，视障用户端实时查看。
7. **安全机制**：紧急联系人 + 一键求助 + 投诉入口。
8. **数据降级**：所有核心功能在云函数失败时退回本地缓存/模拟数据，保证可演示性。

---

## 7. 已知技术债与待办（Roadmap 输入）

| 类别 | 问题 | 建议 |
|------|------|------|
| 订单链路 | `orders`（云端）与 `blind_orders`（本地）两套并存 | 统一为云端订单，本地仅做缓存 |
| 预约链路 | `appointments`（云端）与 `blind_orders`（本地）路径未统一 | 收敛为单一数据源 |
| 运动数据 | 距离/卡路里为模拟计算 | 接入真实 GPS 轨迹与配速算法 |
| 地图 | 高德 Key 为空，marker 资源缺失 | 补充地图 Key 与 marker 图片，或使用默认 marker |
| 登录 | 验证码为模拟 | 接入真实短信验证码服务 |
| 演示开关 | `skipVideo` / `skipExam` 等降级逻辑 | 生产环境关闭 |
| 兑换码 | 无过期清理 | 增加定时触发器清理过期兑换码 |
| 安全 | 数据库安全规则 | 生产环境配置集合级安全规则与环境隔离 |

---

## 8. 非功能性需求

- **可访问性（A11y）**：面向视障用户，应强化语音播报、大字体、高对比度、震动反馈（当前已有震动提醒）。
- **实时性**：订单状态与位置同步依赖云数据库 Watch，需保证低延迟。
- **可靠性**：云端不可用时本地降级，不阻断核心流程。
- **隐私与安全**：位置信息需用户授权；紧急联系人、手机号等敏感信息需保护；遵循微信云开发数据安全规则。
- **环境隔离**：开发/测试/生产使用不同云开发环境 ID。

---

> 本 PRD 基于现有代码库实现整理，反映「当前已实现 + 已知待办」的真实状态，可作为后续迭代与团队协作的基线文档。功能点中标注 `[REQ]` 为已实现需求，`[TODO]` 为待完善项。
