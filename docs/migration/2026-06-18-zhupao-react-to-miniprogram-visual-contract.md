# zhupao React 到微信小程序迁移视觉契约

## 范围

- 源项目：`web/` Vite React App。
- 目标项目：仓库根目录原生微信小程序。
- 后端策略：沿用现有 CloudBase 云函数；仅当前端小程序能力无法兼容时新增接口，不修改现有接口契约。

## Shell 分类

- 源 UI 是“桌面预览中的手机 App”：`DeviceFrame`、桌面品牌区、机型切换、外层手机边框属于 Web 预览外壳。
- 小程序只迁移手机屏幕内的 App：登录页、应用页头、滚动内容区、页面内底部导航。
- 不迁移 Web 桌面预览外壳，不把外框当成小程序页面卡片。

## 导航归属

- 顶部：小程序使用 `navigationStyle: "custom"`，页面内自定义 header 负责品牌、角色 eyebrow、当前 tab 标题和头像入口。
- 底部：React 的 `BottomNav` 是 App 内全局主导航；小程序以页面内自定义 `.bottom-nav` 保留，不使用系统 `tabBar`，避免与旧小程序多页面 tab 混用。
- 页面内按钮、筛选 chip、表单提交、底部 sheet 操作都不是 tabBar。

## 页面映射

- `AuthPage` -> `pages/login/login`
- `HomePage` -> `pages/home/home` 的 `activeTab === "home"`
- `SportPage` -> `pages/home/home` 的 `activeTab === "sport"`
- 视障用户 `OrdersPage` -> `pages/home/home` 的 `activeTab === "orders"`
- 志愿者 `TrainingPage` -> `pages/home/home` 的 `activeTab === "training"`
- `AppointmentsPage` -> `pages/home/home` 的 `activeTab === "appointments"`
- `MinePage` -> `pages/home/home` 的 `activeTab === "mine"`

## 固定区域与滚动

- 页面根节点为 `100vh` flex column。
- header 固定在顶部内容流内，bottom nav 固定在底部内容流内。
- 中间内容区必须使用显式 `ScrollView` 高度，保留底部 nav 和安全区 padding，避免内容被遮挡。
- modal/sheet 放在页面 DOM 靠后位置，使用高 z-index。

## 按钮与文本规则

- 主操作：`.btn--accent` 或志愿者场景 `.btn--pine`。
- 次操作：`.btn--ghost`。
- 危险操作：`.btn--coral`。
- tab/chip/filter 保持稳定高度，激活态不改变布局尺寸。
- header/title/tab/button/chip 文本单行省略或居中；正文、说明、地址详情、多行备注允许换行。

## 已接受的平台降级

- Web 的 Leaflet 地图降级为微信定位、地址搜索、`wx.chooseLocation` 或路线摘要；不在本轮引入第三方地图组件。
- Web 的 lucide 图标降级为短中文图标或文字标识，保持按钮尺寸和层级优先。
- Web 桌面预览专用 `QuickExperience` 迁移为登录页内“一键体验”卡片。
