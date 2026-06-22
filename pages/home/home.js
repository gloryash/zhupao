const api = require('../../utils/api');
const session = require('../../utils/session');
const fmt = require('../../utils/format');
const loc = require('../../utils/location');
const departure = require('../../utils/departure');
const safeArea = require('../../utils/safe-area');
const { speakVoiceCue } = require('../../utils/voice-player');

const DURATIONS = [30, 45, 60, 90];
const DISTANCE_FILTERS = [
  { value: 1000, label: '1 公里' },
  { value: 5000, label: '5 公里' },
  { value: 10000, label: '10 公里' },
  { value: 20000, label: '20 公里' }
];
const GENDER_FILTERS = [
  { value: 'all', label: '性别不限' },
  { value: 'male', label: '男生' },
  { value: 'female', label: '女生' }
];
const AGE_FILTERS = [
  { value: 'all', label: '年龄不限' },
  { value: '18-30', label: '18-30 岁' },
  { value: '31-45', label: '31-45 岁' },
  { value: '46-60', label: '46-60 岁' },
  { value: '60-120', label: '60 岁以上' }
];
const DEPARTURE_FILTERS = [
  { value: 'all', label: '不限' },
  { value: 'immediate', label: '立即出发' },
  { value: 'within', label: '即将出发' },
  { value: 'hour', label: '按整点' },
  { value: 'date', label: '按日期' }
];
const WITHIN_MINUTES = [
  { value: 15, label: '15 分钟内' },
  { value: 30, label: '30 分钟内' },
  { value: 60, label: '1 小时内' },
  { value: 120, label: '2 小时内' }
];
const ADDRESS_HISTORY_PREFIX = 'blindrun_address_history_';
const ADDRESS_HISTORY_LIMIT = 8;
const CITY_MODES = [
  { value: 'all', label: '全部城市' },
  { value: 'current', label: '当前城市' },
  { value: 'custom', label: '指定城市' }
];
const CITY_PRESETS = [
  { value: '上海', label: '上海' },
  { value: '北京', label: '北京' },
  { value: '广州', label: '广州' },
  { value: '深圳', label: '深圳' },
  { value: '杭州', label: '杭州' },
  { value: '成都', label: '成都' }
];
const TAB_ICONS = {
  home: {
    iconPath: '/images/tabbar/home.svg',
    activeIconPath: '/images/tabbar/home-active.svg'
  },
  sport: {
    iconPath: '/images/tabbar/sport.svg',
    activeIconPath: '/images/tabbar/sport-active.svg'
  },
  orders: {
    iconPath: '/images/tabbar/clipboard-list.svg',
    activeIconPath: '/images/tabbar/clipboard-list-active.svg'
  },
  training: {
    iconPath: '/images/tabbar/graduation-cap.svg',
    activeIconPath: '/images/tabbar/graduation-cap-active.svg'
  },
  appointments: {
    iconPath: '/images/tabbar/calendar-days.svg',
    activeIconPath: '/images/tabbar/calendar-days-active.svg'
  },
  mine: {
    iconPath: '/images/tabbar/mine.svg',
    activeIconPath: '/images/tabbar/mine-active.svg'
  }
};
const HIDDEN_TABS = {
  orders: {
    key: 'orders',
    label: '订单',
    eyebrow: '视障跑者',
    title: '我的订单'
  }
};

Page({
  data: {
    user: null,
    avatarText: '?',
    role: 'disabled',
    isVolunteer: false,
    activeTab: 'home',
    navItems: [],
    headerTitle: '向光奔跑',
    eyebrow: '视障跑者',
    voiceCue: '',
    loading: true,
    loadError: '',

    stats: null,
    expPct: 0,
    expToNext: 100,
    homeStats: [],

    activeOrder: null,
    activeOrderView: null,
    orders: [],
    orderFilter: 'all',
    orderFilters: [
      { key: 'all', label: '全部' },
      { key: 'active', label: '进行中' },
      { key: 'completed', label: '已完成' }
    ],
    filteredOrders: [],

    start: null,
    destination: null,
    startQuery: '',
    destinationQuery: '',
    startResults: [],
    destinationResults: [],
    startHistory: [],
    destinationHistory: [],
    startSearching: false,
    destinationSearching: false,
    startSearched: false,
    destinationSearched: false,
    duration: 45,
    durationOptions: DURATIONS,
    departureMode: 'immediate',
    departureHour: new Date().getHours(),
    departureMinute: (new Date().getMinutes() + 30) % 60,
    departureLabel: '立即出发',
    targetDistance: 0,
    publishing: false,
    cancelling: false,

    position: null,
    positionFallback: false,
    currentCity: '',
    waitingOrders: [],
    activeVolunteerOrders: [],
    volunteerFilters: DISTANCE_FILTERS,
    genderFilters: GENDER_FILTERS,
    ageFilters: AGE_FILTERS,
    departureFilters: DEPARTURE_FILTERS,
    withinMinutesOptions: WITHIN_MINUTES,
    cityModes: CITY_MODES,
    cityPresets: CITY_PRESETS,
    maxDistance: 20000,
    maxDistanceLabel: '20 公里',
    showFilters: false,
    activeFilterCount: 0,
    genderFilter: 'all',
    ageRangeFilter: 'all',
    departureFilterType: 'all',
    departureWithinMinutes: 30,
    departureHourFilter: new Date().getHours(),
    departureHourLabel: formatHour(new Date().getHours()),
    departureDateFilter: '',
    cityMode: 'all',
    cityValue: '',
    selectedDemand: null,
    refreshingBoard: false,
    trainingRequired: false,
    completingOrderId: '',
    completeDistance: '',
    completeDuration: '',

    trainingStatus: null,
    certificate: null,
    trainingPct: 0,
    questions: null,
    currentQuestionIndex: 0,
    currentQuestion: null,
    isFirstQuestion: true,
    isLastQuestion: true,
    passScore: 80,
    answeredCount: 0,
    examResult: null,
    certInput: '',
    certVerify: null,

    appointments: [],
    volunteers: [],
    selectedVolunteerId: '',
    apDate: '',
    apTime: '',
    today: fmt.todayISO(),
    apDistance: '',
    apDuration: '',
    apNote: '',
    apAddress: '',
    apDateLabel: '请选择日期',
    apTimeLabel: '请选择时间',
    appointmentNearbyMode: false,
    apRating: 5,
    ratingOptions: [1, 2, 3, 4, 5],
    apComment: '',
    completingAppointmentId: '',

    mineNickName: '',
    mineName: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    savingProfile: false,
    savingEmergency: false,
    shellStyle: ''
  },

  onLoad() {
    this.addressSearchTimers = {};
    this.addressSearchSeq = { start: 0, destination: 0 };
    this.setData({ shellStyle: safeArea.getSafeAreaStyle() });
    this.loadAddressHistories();
    this.bootstrap();
  },

  onShow() {
    if (!this.data.user) this.bootstrap();
  },

  onHide() {
    this.clearAddressSearchTimers();
  },

  onUnload() {
    this.clearAddressSearchTimers();
  },

  async bootstrap() {
    const current = session.requireSession();
    if (!current) return;
    const user = current.user;
    const role = user.userType || 'disabled';
    this.setData({
      user,
      role,
      isVolunteer: role === 'volunteer',
      navItems: buildTabs(role),
      avatarText: initial(user.nickName),
      mineNickName: user.nickName || '',
      mineName: user.name || '',
      emergencyName: user.emergencyName || '',
      emergencyPhone: user.emergencyPhone || '',
      emergencyRelation: user.emergencyRelation || ''
    });
    this.syncChrome(defaultEntryTab(role, user));
    await this.loadCurrentTab();
  },

  syncChrome(tabKey) {
    const tabs = buildTabs(this.data.role);
    const tab = tabs.find((item) => item.key === tabKey) || resolveHiddenTab(tabKey, this.data.role) || tabs[0];
    const activeNavKey = tab.navKey || tab.key;
    this.setData({
      activeTab: tab.key,
      headerTitle: tab.title,
      eyebrow: tab.eyebrow,
      navItems: tabs.map((item) => ({ ...item, active: item.key === activeNavKey }))
    });
  },

  async switchTab(e) {
    const key = e.currentTarget.dataset.key;
    this.syncChrome(key);
    this.announce(tabVoiceLabel(this.data.activeTab, this.data.headerTitle));
    await this.loadCurrentTab();
  },

  goMine() {
    this.syncChrome('mine');
    this.announce('进入个人中心');
    this.loadCurrentTab();
  },

  async refreshCurrentTab() {
    this.announce('刷新重试');
    await this.loadCurrentTab();
  },

  openLightMap() {
    wx.navigateTo({ url: '/pages/light-map/light-map' });
  },

  async loadCurrentTab() {
    const key = this.data.activeTab;
    if (key === 'home') return this.loadHome();
    if (key === 'sport') return this.loadSport();
    if (key === 'orders') return this.loadOrders();
    if (key === 'training') return this.loadTraining();
    if (key === 'appointments') return this.loadAppointments();
    if (key === 'mine') return this.loadMine();
  },

  async loadHome() {
    this.setData({ loading: true, loadError: '' });
    try {
      const [fresh, stats] = await Promise.all([api.getUserProfile(), api.getUserStats()]);
      session.updateUser(fresh);
      const progress = fmt.expProgress((stats && stats.exp) || fresh.exp || 0);
      this.setData({
        user: fresh,
        avatarText: initial(fresh.nickName),
        stats,
        expPct: progress.pct,
        expToNext: progress.toNext,
        homeStats: buildHomeStats(fresh, stats),
        mineNickName: fresh.nickName || '',
        mineName: fresh.name || '',
        emergencyName: fresh.emergencyName || '',
        emergencyPhone: fresh.emergencyPhone || '',
        emergencyRelation: fresh.emergencyRelation || '',
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false, loadError: err.message || '没能加载你的数据' });
    }
  },

  async toggleAvailability() {
    if (!this.data.isVolunteer) return;
    const next = !this.data.user.isAvailable;
    wx.showLoading({ title: next ? '上线中...' : '下线中...' });
    try {
      const pos = next ? await loc.getCurrentPosition() : null;
      await api.updateAvailability(next, pos ? pos.latitude : undefined, pos ? pos.longitude : undefined);
      const user = { ...this.data.user, isAvailable: next, ...(pos || {}) };
      session.updateUser(user);
      this.setData({ user, avatarText: initial(user.nickName) });
      wx.showToast({ title: next ? '已上线' : '已下线', icon: 'success' });
    } catch (err) {
      wx.showToast({ title: err.message || '更新失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async loadSport() {
    if (this.data.isVolunteer) return this.loadVolunteerBoard();
    return this.loadRunnerSport();
  },

  async loadRunnerSport() {
    this.setData({ loading: true, loadError: '' });
    try {
      const order = await api.getOrderDetail();
      this.setData({
        activeOrder: order,
        activeOrderView: order ? fmt.decorateOrder(order, 'disabled') : null,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false, loadError: err.message || '订单加载失败' });
    }
  },

  onAddressInput(e) {
    const field = e.currentTarget.dataset.field;
    const query = e.detail.value || '';
    this.setData({ [`${field}Query`]: query });
    this.scheduleAddressSearch(field);
  },

  async searchEndpoint(e) {
    const field = e.currentTarget.dataset.field;
    if (!field) return;
    await this.runAddressSearch(field, { notify: true });
  },

  scheduleAddressSearch(field) {
    if (!field) return;
    if (!this.addressSearchTimers) this.addressSearchTimers = {};
    if (!this.addressSearchSeq) this.addressSearchSeq = {};
    if (this.addressSearchTimers && this.addressSearchTimers[field]) {
      clearTimeout(this.addressSearchTimers[field]);
    }
    const query = (this.data[`${field}Query`] || '').trim();
    if (query.length < 2) {
      this.setData({
        [`${field}Results`]: [],
        [`${field}Searching`]: false,
        [`${field}Searched`]: false
      });
      return;
    }
    this.setData({ [`${field}Searching`]: true });
    this.addressSearchTimers[field] = setTimeout(() => {
      this.runAddressSearch(field, { notify: false });
    }, 350);
  },

  clearAddressSearchTimers() {
    if (!this.addressSearchTimers) return;
    Object.values(this.addressSearchTimers).forEach((timer) => clearTimeout(timer));
    this.addressSearchTimers = {};
  },

  async runAddressSearch(field, options = {}) {
    const query = this.data[`${field}Query`];
    if (!query || query.trim().length < 2) {
      this.setData({
        [`${field}Results`]: [],
        [`${field}Searching`]: false,
        [`${field}Searched`]: false
      });
      if (options.notify) wx.showToast({ title: '请输入至少两个字', icon: 'none' });
      return;
    }
    const seq = (this.addressSearchSeq[field] || 0) + 1;
    this.addressSearchSeq[field] = seq;
    if (options.notify) wx.showLoading({ title: '搜索中...' });
    this.setData({ [`${field}Searching`]: true });
    try {
      const results = await loc.searchAddress(query, this.data.currentCity || '');
      if (this.addressSearchSeq[field] !== seq) return;
      this.setData({
        [`${field}Results`]: results,
        [`${field}Searching`]: false,
        [`${field}Searched`]: true
      });
      if (options.notify && results.length === 0) wx.showToast({ title: '没有找到匹配地点', icon: 'none' });
    } catch (err) {
      if (this.addressSearchSeq[field] !== seq) return;
      this.setData({
        [`${field}Results`]: [],
        [`${field}Searching`]: false,
        [`${field}Searched`]: true
      });
      if (options.notify) wx.showToast({ title: err.message || '搜索失败', icon: 'none' });
    } finally {
      if (options.notify) wx.hideLoading();
    }
  },

  async chooseCurrentEndpoint(e) {
    const field = e.currentTarget.dataset.field;
    this.announce(`打开${field === 'start' ? '起点' : '终点'}地图选点`);
    try {
      const selected = await loc.chooseAddress();
      this.setEndpoint(field, selected);
    } catch (err) {
      if (!err || !String(err.errMsg || err.message || '').includes('cancel')) {
        wx.showToast({ title: '未能打开地图选点', icon: 'none' });
      }
    }
  },

  selectEndpoint(e) {
    const field = e.currentTarget.dataset.field;
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data[`${field}Results`][index];
    this.setEndpoint(field, item);
  },

  selectHistoryEndpoint(e) {
    const field = e.currentTarget.dataset.field;
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data[`${field}History`][index];
    this.setEndpoint(field, item);
  },

  clearEndpoint(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({
      [field]: null,
      [`${field}Query`]: '',
      [`${field}Results`]: [],
      [`${field}Searched`]: false,
      [`${field}Searching`]: false,
      targetDistance: field === 'start' || field === 'destination' ? 0 : this.data.targetDistance
    });
    this.announce(`更改${field === 'start' ? '起点' : '终点'}`);
  },

  setEndpoint(field, item) {
    if (!field || !item) return;
    const display = buildEndpointDisplay(item);
    const value = {
      latitude: item.latitude,
      longitude: item.longitude,
      name: display.name,
      address: display.address,
      detail: display.detail,
      displayName: display.displayName,
      displayDetail: display.displayDetail,
      displayAddress: display.displayAddress,
      city: item.city || ''
    };
    const next = {
      [field]: value,
      [`${field}Query`]: '',
      [`${field}Results`]: []
    };
    const start = field === 'start' ? value : this.data.start;
    const destination = field === 'destination' ? value : this.data.destination;
    if (start && destination) next.targetDistance = loc.straightLineDistanceKm(start, destination);
    this.setData(next);
    this.pushAddressHistory(field, value);
    this.announce(`已选择${field === 'start' ? '起点' : '终点'}：${value.displayAddress}`);
  },

  loadAddressHistories() {
    this.setData({
      startHistory: readAddressHistory('start'),
      destinationHistory: readAddressHistory('destination')
    });
  },

  pushAddressHistory(field, item) {
    const next = pushAddressHistory(field, item);
    this.setData({ [`${field}History`]: next });
  },

  setDuration(e) {
    const duration = Number(e.currentTarget.dataset.value);
    this.setData({ duration });
    this.announce(`预计时长 ${duration} 分钟`);
  },

  setDepartureMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ departureMode: mode }, () => this.updateDepartureLabel());
    this.announce(mode === 'delayed' ? '已选择延后出发' : '已选择立即出发');
  },

  onDepartureInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: Number(e.detail.value) }, () => this.updateDepartureLabel());
  },

  updateDepartureLabel() {
    const value = this.buildDepartureValue();
    this.setData({ departureLabel: departure.buildDeparturePayload(value).departureLabel });
  },

  buildDepartureValue() {
    if (this.data.departureMode === 'delayed') {
      return departure.createClockDeparture(this.data.departureHour, this.data.departureMinute);
    }
    return departure.DEFAULT_DEPARTURE;
  },

  async publishRunnerOrder() {
    if (this.data.publishing) return;
    let { start, destination } = this.data;
    if (!start && this.data.startQuery.trim()) {
      const found = await loc.searchAddress(this.data.startQuery);
      start = found[0] || { ...loc.SHANGHAI, address: this.data.startQuery.trim() };
    }
    if (!destination && this.data.destinationQuery.trim()) {
      const found = await loc.searchAddress(this.data.destinationQuery);
      destination = found[0] || { ...loc.SHANGHAI, address: this.data.destinationQuery.trim(), longitude: loc.SHANGHAI.longitude + 0.02 };
    }
    if (!start || !destination) {
      this.announce('请先选择起点和终点');
      wx.showToast({ title: '请先选择起点和终点', icon: 'none' });
      return;
    }
    this.setData({ publishing: true });
    wx.showLoading({ title: '发布中...' });
    try {
      const dep = departure.buildDeparturePayload(this.buildDepartureValue());
      const targetDistance = loc.straightLineDistanceKm(start, destination);
      const readableStart = endpointForPublish(start);
      const readableDestination = endpointForPublish(destination);
      const order = await api.publishOrder({
        origin: readableStart,
        destination: readableDestination,
        targetDistance,
        estimatedDuration: this.data.duration,
        ...dep,
        city: start.city || destination.city
      });
      this.setData({
        start,
        destination: null,
        destinationQuery: '',
        targetDistance,
        activeOrder: order,
        activeOrderView: fmt.decorateOrder(order, 'disabled')
      });
      wx.showToast({ title: '陪跑需求已发布', icon: 'success' });
      this.announce('已发布陪跑请求，正在为你匹配志愿者');
    } catch (err) {
      this.announce(err.message || '发布失败');
      wx.showToast({ title: err.message || '发布失败', icon: 'none' });
    } finally {
      wx.hideLoading();
      this.setData({ publishing: false });
    }
  },

  async cancelOrder(e) {
    const orderId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || (this.data.activeOrder && this.data.activeOrder._id);
    if (!orderId || this.data.cancelling) return;
    this.setData({ cancelling: true });
    try {
      await api.cancelOrder(orderId);
      wx.showToast({ title: '已取消', icon: 'success' });
      this.announce('已取消该陪跑请求');
      await this.loadCurrentTab();
    } catch (err) {
      this.announce(err.message || '取消失败');
      wx.showToast({ title: err.message || '取消失败', icon: 'none' });
    } finally {
      this.setData({ cancelling: false });
    }
  },

  async loadVolunteerBoard() {
    this.setData({ loading: true, loadError: '' });
    const pos = await loc.bestEffortPosition();
    const currentCity = await this.resolveCurrentCity(pos);
    try {
      const query = this.buildWaitingOrderQuery(pos, currentCity);
      const [mine, waiting] = await Promise.all([
        api.getMyOrders(),
        api.getWaitingOrders(query)
      ]);
      this.setData({
        position: pos,
        positionFallback: pos && pos.source === 'fallback',
        currentCity,
        activeVolunteerOrders: mine.filter((o) => ['accepted', 'arrived', 'running'].indexOf(o.status) >= 0).map((o) => fmt.decorateOrder(o, 'volunteer')),
        waitingOrders: waiting.map((o) => fmt.decorateOrder(o, 'volunteer')),
        trainingRequired: false,
        loading: false
      });
    } catch (err) {
      this.setData({
        position: pos,
        positionFallback: pos && pos.source === 'fallback',
        currentCity,
        waitingOrders: [],
        trainingRequired: err.code === 'TRAINING_REQUIRED',
        loading: false,
        loadError: err.code === 'TRAINING_REQUIRED' ? '' : (err.message || '加载失败')
      });
    }
  },

  async refreshVolunteerBoard() {
    this.setData({ refreshingBoard: true });
    await this.loadVolunteerBoard();
    this.setData({ refreshingBoard: false });
  },

  async resolveCurrentCity(pos) {
    if (!pos || !pos.latitude || !pos.longitude) return this.data.currentCity || '';
    if (this.data.currentCity && this.data.position && this.data.position.latitude === pos.latitude && this.data.position.longitude === pos.longitude) {
      return this.data.currentCity;
    }
    try {
      const address = await api.reverseGeocode(pos.latitude, pos.longitude);
      return address.city || '';
    } catch (err) {
      return this.data.currentCity || '';
    }
  },

  buildWaitingOrderQuery(pos, currentCity) {
    const d = this.data;
    const query = {
      latitude: pos.latitude,
      longitude: pos.longitude,
      maxDistance: d.maxDistance,
      gender: d.genderFilter,
      ageRange: d.ageRangeFilter,
      city: resolveCityFilter(d.cityMode, d.cityValue, currentCity),
      departureFilterType: d.departureFilterType,
      distanceBasis: 'origin'
    };
    if (d.departureFilterType === 'within') query.departureWithinMinutes = d.departureWithinMinutes;
    if (d.departureFilterType === 'hour') query.departureHour = d.departureHourFilter;
    if (d.departureFilterType === 'date' && d.departureDateFilter) query.departureDate = d.departureDateFilter;
    return query;
  },

  toggleFilters() {
    this.setData({ showFilters: !this.data.showFilters });
  },

  setMaxDistance(e) {
    const value = Number(e.currentTarget.dataset.value);
    const option = DISTANCE_FILTERS.find((item) => item.value === value);
    this.setData({
      maxDistance: value,
      maxDistanceLabel: option ? option.label : '20 公里',
      activeFilterCount: countActiveFilters({ ...this.data, maxDistance: value })
    }, () => this.loadVolunteerBoard());
  },

  setBoardFilter(e) {
    const key = e.currentTarget.dataset.key;
    let value = e.currentTarget.dataset.value;
    if (key === 'departureWithinMinutes' || key === 'departureHourFilter') value = Number(value);
    this.setData({ [key]: value }, () => {
      this.setData({ activeFilterCount: countActiveFilters(this.data) });
      this.loadVolunteerBoard();
    });
  },

  stepDepartureHour(e) {
    const delta = Number(e.currentTarget.dataset.delta);
    const next = Math.max(0, Math.min(23, Number(this.data.departureHourFilter) + delta));
    this.setData({
      departureHourFilter: next,
      departureHourLabel: formatHour(next),
      activeFilterCount: countActiveFilters({ ...this.data, departureHourFilter: next })
    }, () => this.loadVolunteerBoard());
  },

  onDepartureDateFilter(e) {
    const value = e.detail.value;
    this.setData({ departureDateFilter: value, activeFilterCount: countActiveFilters({ ...this.data, departureDateFilter: value }) }, () => this.loadVolunteerBoard());
  },

  onCityFilterInput(e) {
    const value = e.detail.value;
    this.setData({ cityValue: value, activeFilterCount: countActiveFilters({ ...this.data, cityValue: value }) }, () => this.loadVolunteerBoard());
  },

  resetBoardFilters() {
    this.setData({
      maxDistance: 20000,
      maxDistanceLabel: '20 公里',
      genderFilter: 'all',
      ageRangeFilter: 'all',
      departureFilterType: 'all',
      departureWithinMinutes: 30,
      departureHourFilter: new Date().getHours(),
      departureHourLabel: formatHour(new Date().getHours()),
      departureDateFilter: '',
      cityMode: 'all',
      cityValue: '',
      activeFilterCount: 0
    }, () => this.loadVolunteerBoard());
  },

  openDemandDetail(e) {
    const index = Number(e.currentTarget.dataset.index);
    const selectedDemand = this.data.waitingOrders[index] || null;
    this.setData({ selectedDemand, showFilters: false });
  },

  closeDemandDetail() {
    this.setData({ selectedDemand: null });
  },

  async acceptWaitingOrder(e) {
    const id = e.currentTarget.dataset.id;
    try {
      await api.acceptOrder(id, this.data.position || undefined);
      this.setData({ selectedDemand: null });
      wx.showToast({ title: '已接单', icon: 'success' });
      await this.loadVolunteerBoard();
    } catch (err) {
      wx.showToast({ title: err.message || '接单失败', icon: 'none' });
    }
  },

  async updateActiveOrderStatus(e) {
    const id = e.currentTarget.dataset.id;
    const status = e.currentTarget.dataset.status;
    try {
      await api.updateOrderStatus(id, status);
      wx.showToast({ title: status === 'arrived' ? '已标记到达' : '已开始陪跑', icon: 'success' });
      await this.loadVolunteerBoard();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  async uploadVolunteerLocation(e) {
    const id = e.currentTarget.dataset.id;
    const pos = await loc.bestEffortPosition();
    try {
      await api.updateVolunteerLocation({
        orderId: id,
        latitude: pos.latitude,
        longitude: pos.longitude,
        runningStats: { distance: 0.5, duration: 4, pace: '8\'00"/km' }
      });
      wx.showToast({ title: '定位已上传', icon: 'success' });
      await this.loadVolunteerBoard();
    } catch (err) {
      wx.showToast({ title: err.message || '上传失败', icon: 'none' });
    }
  },

  onCompleteInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: e.detail.value });
  },

  async completeActiveOrder(e) {
    const id = e.currentTarget.dataset.id;
    const dist = Number(this.data.completeDistance);
    const dur = Number(this.data.completeDuration);
    if (!dist || !dur) {
      wx.showToast({ title: '请填写距离和时长', icon: 'none' });
      return;
    }
    try {
      await api.completeOrder(id, dist, dur);
      this.setData({ completeDistance: '', completeDuration: '' });
      wx.showToast({ title: '已完成陪跑', icon: 'success' });
      await this.loadVolunteerBoard();
    } catch (err) {
      wx.showToast({ title: err.message || '完成失败', icon: 'none' });
    }
  },

  async loadOrders() {
    this.setData({ loading: true, loadError: '' });
    try {
      const orders = await api.getMyOrders();
      this.setData({ orders: orders.map((o) => fmt.decorateOrder(o, this.data.role)), loading: false }, () => this.applyOrderFilter());
    } catch (err) {
      this.setData({ loading: false, loadError: err.message || '订单加载失败' });
    }
  },

  async refreshOrders() {
    this.announce('刷新订单');
    await this.loadOrders();
  },

  setOrderFilter(e) {
    const key = e.currentTarget.dataset.key;
    const option = (this.data.orderFilters || []).find((item) => item.key === key);
    this.announce(`订单筛选${option ? option.label : ''}`);
    this.setData({ orderFilter: key }, () => this.applyOrderFilter());
  },

  applyOrderFilter() {
    const filter = this.data.orderFilter;
    const filtered = this.data.orders.filter((order) => {
      if (filter === 'all') return true;
      if (filter === 'completed') return order.status === 'completed';
      return fmt.isActiveOrder(order.status);
    });
    this.setData({ filteredOrders: filtered });
  },

  async loadTraining() {
    if (!this.data.isVolunteer) {
      this.setData({ loading: false });
      return;
    }
    this.setData({ loading: true, loadError: '' });
    try {
      const [status, cert] = await Promise.all([api.getTrainingStatus(), api.getCertificate()]);
      const flags = [!!(status && status.videoWatched), status && status.examPassed === true, !!(status && status.certificateNo)];
      this.setData({
        trainingStatus: status,
        certificate: cert,
        certInput: status && status.certificateNo ? status.certificateNo : '',
        trainingPct: Math.round(flags.filter(Boolean).length / flags.length * 100),
        questions: null,
        currentQuestionIndex: 0,
        currentQuestion: null,
        isFirstQuestion: true,
        isLastQuestion: true,
        answeredCount: 0,
        examResult: null,
        loading: false
      });
    } catch (err) {
      this.setData({ loading: false, loadError: err.message || '培训进度加载失败' });
    }
  },

  async markVideoWatched() {
    try {
      await api.markVideoWatched();
      wx.showToast({ title: '已记录视频观看', icon: 'success' });
      await this.loadTraining();
    } catch (err) {
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  async startExam() {
    wx.showLoading({ title: '加载题目...' });
    try {
      const res = await api.getExamQuestions();
      this.setData({
        questions: (res.questions || []).sort((a, b) => (a.order || 0) - (b.order || 0)).map((q) => ({
          ...q,
          optionsView: (q.options || []).map((text, index) => ({ text, index, selected: false }))
        })),
        currentQuestionIndex: 0,
        currentQuestion: null,
        isFirstQuestion: true,
        isLastQuestion: true,
        passScore: res.passScore || 80,
        answeredCount: 0,
        examResult: null
      }, () => this.syncCurrentQuestion());
    } catch (err) {
      wx.showToast({ title: err.message || '题目加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  chooseExamOption(e) {
    const qi = Number(e.currentTarget.dataset.qi);
    const oi = Number(e.currentTarget.dataset.oi);
    const questions = this.data.questions.map((q, index) => {
      if (index !== qi) return q;
      return { ...q, selectedIndex: oi, optionsView: q.optionsView.map((opt) => ({ ...opt, selected: opt.index === oi })) };
    });
    this.setData({
      questions,
      answeredCount: questions.filter((q) => q.selectedIndex !== undefined).length
    }, () => this.syncCurrentQuestion());
  },

  prevExamQuestion() {
    const next = Math.max(0, Number(this.data.currentQuestionIndex || 0) - 1);
    this.setData({ currentQuestionIndex: next }, () => this.syncCurrentQuestion());
  },

  nextExamQuestion() {
    const total = (this.data.questions || []).length;
    const next = Math.min(Math.max(total - 1, 0), Number(this.data.currentQuestionIndex || 0) + 1);
    this.setData({ currentQuestionIndex: next }, () => this.syncCurrentQuestion());
  },

  syncCurrentQuestion() {
    const questions = this.data.questions || [];
    const max = Math.max(questions.length - 1, 0);
    const index = Math.max(0, Math.min(max, Number(this.data.currentQuestionIndex) || 0));
    this.setData({
      currentQuestionIndex: index,
      currentQuestion: questions[index] || null,
      isFirstQuestion: index <= 0,
      isLastQuestion: index >= max
    });
  },

  async submitExam() {
    const questions = this.data.questions || [];
    if (questions.some((q) => q.selectedIndex === undefined)) {
      wx.showToast({ title: '请回答全部题目后再提交', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '提交中...' });
    try {
      const result = await api.submitExam(questions.map((q) => ({ questionId: q._id, selectedIndex: q.selectedIndex })));
      this.setData({ examResult: result });
      wx.showToast({ title: result.passed ? '考核通过' : '未通过，可再试', icon: result.passed ? 'success' : 'none' });
      if (result.passed) await this.loadTraining();
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  retryExam() {
    this.setData({
      examResult: null,
      questions: null,
      answeredCount: 0,
      currentQuestionIndex: 0,
      currentQuestion: null,
      isFirstQuestion: true,
      isLastQuestion: true
    });
  },

  onCertInput(e) {
    this.setData({ certInput: e.detail.value });
  },

  async verifyCert() {
    if (!this.data.certInput.trim()) {
      wx.showToast({ title: '请输入证书编号', icon: 'none' });
      return;
    }
    try {
      const res = await api.verifyCertificate(this.data.certInput.trim());
      this.setData({ certVerify: res });
    } catch (err) {
      wx.showToast({ title: err.message || '核验失败', icon: 'none' });
    }
  },

  async loadAppointments() {
    this.setData({ loading: true, loadError: '' });
    try {
      const list = await api.getAppointments();
      const next = { appointments: list.map((a) => fmt.decorateAppointment(a, this.data.role)), loading: false };
      if (!this.data.isVolunteer) {
        const volunteers = await api.getVolunteers();
        next.volunteers = mapVolunteers(volunteers);
        next.appointmentNearbyMode = false;
      }
      this.setData(next);
    } catch (err) {
      this.setData({ loading: false, loadError: err.message || '约跑加载失败' });
    }
  },

  onAppointmentInput(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },

  onAppointmentPicker(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.detail.value;
    const labelKey = key === 'apDate' ? 'apDateLabel' : 'apTimeLabel';
    this.setData({ [key]: value, [labelKey]: value || (key === 'apDate' ? '请选择日期' : '请选择时间') });
    this.announce(`${key === 'apDate' ? '约跑日期' : '约跑时间'}：${value || '未选择'}`);
  },

  announceAppointmentPicker(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const voice = dataset.voice;
    this.announce(voice);
  },

  selectVolunteer(e) {
    this.setData({ selectedVolunteerId: e.currentTarget.dataset.id });
    const selected = (this.data.volunteers || []).find((item) => item._id === e.currentTarget.dataset.id);
    if (selected) this.announce(`已选择志愿者：${selected.nickName || '志愿者'}`);
  },

  async useAppointmentLocation() {
    this.announce('选择集合地点');
    let current = null;
    try {
      current = await loc.chooseAddress();
    } catch (err) {
      current = await loc.resolveCurrentAddress();
    }
    const next = { apAddress: current.address || '' };
    if (current.latitude && current.longitude) {
      try {
        const nearby = await api.getAvailableVolunteers(current.latitude, current.longitude, 50000);
        if (nearby.length > 0) {
          next.volunteers = mapVolunteers(nearby);
          next.appointmentNearbyMode = true;
        }
      } catch (err) {
        /* keep the existing volunteer roster */
      }
    }
    this.setData(next);
    if (next.apAddress) this.announce(`集合地点：${next.apAddress}`);
  },

  async submitAppointment() {
    if (!this.data.selectedVolunteerId || !this.data.apDate || !this.data.apTime) {
      this.announce('请选择志愿者、日期和时间');
      wx.showToast({ title: '请选择志愿者、日期和时间', icon: 'none' });
      return;
    }
    try {
      const created = await api.createAppointment({
        volunteerId: this.data.selectedVolunteerId,
        appointmentDate: this.data.apDate,
        appointmentTime: this.data.apTime,
        address: this.data.apAddress || undefined,
        targetDistance: this.data.apDistance || undefined,
        estimatedDuration: this.data.apDuration || undefined,
        note: this.data.apNote.trim() || undefined
      });
      const appointments = [fmt.decorateAppointment(created, this.data.role), ...this.data.appointments];
      this.setData({
        appointments,
        selectedVolunteerId: '',
        apDate: '',
        apTime: '',
        apDistance: '',
        apDuration: '',
        apNote: '',
        apAddress: '',
        apDateLabel: '请选择日期',
        apTimeLabel: '请选择时间'
      });
      wx.showToast({ title: '约跑邀请已发送', icon: 'success' });
      this.announce('约跑邀请已发送，请等待志愿者确认');
    } catch (err) {
      this.announce(err.message || '预约失败');
      wx.showToast({ title: err.message || '预约失败', icon: 'none' });
    }
  },

  async appointmentAction(e) {
    const id = e.currentTarget.dataset.id;
    const action = e.currentTarget.dataset.action;
    if (action === 'cancel') this.announce('取消约跑');
    if (action === 'complete') this.announce('提交评价');
    try {
      if (action === 'confirm') await api.confirmAppointment(id);
      if (action === 'cancel') await api.cancelAppointment(id);
      if (action === 'complete') {
        await api.completeAppointment(id, this.data.apRating, this.data.apComment.trim() || undefined);
        this.setData({ completingAppointmentId: '', apComment: '', apRating: 5 });
      }
      wx.showToast({ title: '操作成功', icon: 'success' });
      if (action === 'cancel') this.announce('约跑已取消');
      if (action === 'complete') this.announce('评价已提交');
      await this.loadAppointments();
    } catch (err) {
      this.announce(err.message || '操作失败');
      wx.showToast({ title: err.message || '操作失败', icon: 'none' });
    }
  },

  openCompleteAppointment(e) {
    this.setData({ completingAppointmentId: e.currentTarget.dataset.id });
    this.announce('完成并评价');
  },

  closeCompleteAppointment() {
    this.setData({ completingAppointmentId: '', apComment: '', apRating: 5 });
  },

  setRating(e) {
    const rating = Number(e.currentTarget.dataset.value);
    this.setData({ apRating: rating });
    this.announce(`${rating} 分`);
  },

  async refreshAppointments() {
    this.announce('刷新约跑');
    await this.loadAppointments();
  },

  async loadMine() {
    await this.loadHome();
    this.setData({ loading: false });
  },

  onMineInput(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value });
  },

  async saveProfile() {
    if (!this.data.mineNickName.trim()) {
      this.announce('昵称不能为空');
      wx.showToast({ title: '昵称不能为空', icon: 'none' });
      return;
    }
    this.setData({ savingProfile: true });
    try {
      const updated = await api.updateProfile({ nickName: this.data.mineNickName.trim(), name: this.data.mineName.trim() });
      session.updateUser(updated);
      this.setData({ user: updated, avatarText: initial(updated.nickName) });
      wx.showToast({ title: '资料已更新', icon: 'success' });
      this.announce('资料已更新');
    } catch (err) {
      this.announce(err.message || '保存失败');
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ savingProfile: false });
    }
  },

  async saveEmergency() {
    if (!this.data.emergencyName.trim() || !this.data.emergencyPhone.trim()) {
      this.announce('请填写联系人姓名和电话');
      wx.showToast({ title: '请填写联系人姓名和电话', icon: 'none' });
      return;
    }
    this.setData({ savingEmergency: true });
    try {
      await api.updateEmergencyContact({
        emergencyName: this.data.emergencyName.trim(),
        emergencyPhone: this.data.emergencyPhone.trim(),
        emergencyRelation: this.data.emergencyRelation.trim()
      });
      const user = {
        ...this.data.user,
        emergencyName: this.data.emergencyName.trim(),
        emergencyPhone: this.data.emergencyPhone.trim(),
        emergencyRelation: this.data.emergencyRelation.trim()
      };
      session.updateUser(user);
      this.setData({ user, avatarText: initial(user.nickName) });
      wx.showToast({ title: '联系人已更新', icon: 'success' });
      this.announce('联系人已更新');
    } catch (err) {
      this.announce(err.message || '保存失败');
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      this.setData({ savingEmergency: false });
    }
  },

  async logout() {
    this.announce('退出登录');
    const token = session.getToken();
    session.clearSession();
    wx.reLaunch({ url: '/pages/login/login' });
    try {
      await api.logoutAccount(token);
    } catch (err) {
      /* best-effort */
    }
  },

  noop() {
    /* used by catchtap */
  },

  announceTap(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const voice = dataset.voice;
    this.announce(voice);
  },

  announceInputFocus(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const voice = dataset.voice;
    this.announce(voice);
  },

  announceMineInput(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const voice = dataset.voice;
    this.announce(voice);
  },

  announce(message) {
    const text = String(message || '').replace(/\s+/g, ' ').trim();
    if (!text || this.data.isVolunteer) return;
    this.setData({ voiceCue: text });
    speakVoiceCue(text);
  }
});

function initial(name) {
  return String(name || '?').trim().slice(0, 1).toUpperCase();
}

function buildTabs(role) {
  const isVolunteer = role === 'volunteer';
  const eyebrow = isVolunteer ? '陪跑志愿者' : '视障跑者';
  const tabs = [
    { key: 'home', label: '首页', eyebrow, title: '向光奔跑' },
    { key: 'sport', label: isVolunteer ? '接单' : '陪跑', eyebrow, title: isVolunteer ? '接单广场' : '发起陪跑' },
    ...(isVolunteer ? [{ key: 'training', label: '培训', eyebrow, title: '陪跑培训' }] : []),
    { key: 'appointments', label: '约跑', eyebrow, title: '约跑日程' },
    { key: 'mine', label: '我的', eyebrow, title: '个人中心' }
  ];
  return tabs.map((item) => ({ ...item, ...TAB_ICONS[item.key] }));
}

function resolveHiddenTab(tabKey, role) {
  if (tabKey !== 'orders' || role === 'volunteer') return null;
  return { ...HIDDEN_TABS.orders, navKey: 'mine' };
}

function defaultEntryTab(role, user) {
  if (role === 'volunteer' && !isVolunteerCertified(user)) return 'training';
  return 'home';
}

function isVolunteerCertified(user) {
  if (!user) return false;
  return !!(user.certificateNo || user.certificationStatus === 'certified' || (user.videoWatched && user.examPassed));
}

function tabVoiceLabel(tabKey, headerTitle) {
  if (tabKey === 'sport' && headerTitle === '接单广场') return '进入接单广场';
  if (tabKey === 'sport') return '进入发起陪跑';
  if (tabKey === 'appointments') return '进入约跑日程';
  if (tabKey === 'mine') return '进入个人中心';
  if (tabKey === 'orders') return '进入我的订单';
  if (tabKey === 'training') return '进入陪跑培训';
  return `进入${headerTitle || '页面'}`;
}

function buildHomeStats(user, stats) {
  return [
    { label: '累计陪跑', value: stats && stats.totalRuns !== undefined ? stats.totalRuns : (user.totalRuns || 0) },
    { label: '总里程', value: fmt.formatDistance(stats && stats.totalDistance !== undefined ? stats.totalDistance : user.totalDistance) },
    { label: '总时长', value: fmt.formatDuration(stats && stats.totalTime !== undefined ? stats.totalTime : user.totalTime) },
    { label: '积分', value: stats && stats.points !== undefined ? stats.points : (user.points || 0) },
    { label: '经验值', value: stats && stats.exp !== undefined ? stats.exp : (user.exp || 0) },
    { label: '完成订单', value: stats && stats.completedOrders !== undefined ? stats.completedOrders : 0 }
  ];
}

function resolveCityFilter(mode, value, currentCity) {
  if (mode === 'current') return currentCity || 'all';
  if (mode === 'custom') return String(value || '').trim() || 'all';
  return 'all';
}

function countActiveFilters(data) {
  let count = 0;
  if (Number(data.maxDistance) !== 20000) count += 1;
  if (data.genderFilter !== 'all') count += 1;
  if (data.ageRangeFilter !== 'all') count += 1;
  if (data.departureFilterType !== 'all') count += 1;
  if (data.cityMode !== 'all') count += 1;
  return count;
}

function mapVolunteers(volunteers) {
  return (volunteers || []).map((v) => ({
    ...v,
    nickNameInitial: initial(v.nickName) || '志',
    distanceText: v.distance ? fmt.formatMeters(v.distance) : ''
  }));
}

function formatHour(hour) {
  const n = Math.max(0, Math.min(23, Number(hour) || 0));
  return `${String(n).padStart(2, '0')}:00`;
}

function addressHistoryKey(field) {
  return `${ADDRESS_HISTORY_PREFIX}${field}`;
}

function readAddressHistory(field) {
  try {
    const raw = wx.getStorageSync(addressHistoryKey(field));
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item) => item && item.address && Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)))
      .slice(0, ADDRESS_HISTORY_LIMIT);
  } catch (err) {
    return [];
  }
}

function pushAddressHistory(field, item) {
  const display = buildEndpointDisplay(item);
  const entry = {
    latitude: Number(item.latitude),
    longitude: Number(item.longitude),
    name: display.name,
    address: display.address,
    detail: display.detail,
    displayName: display.displayName,
    displayDetail: display.displayDetail,
    displayAddress: display.displayAddress,
    city: item.city || ''
  };
  if (!entry.address || !Number.isFinite(entry.latitude) || !Number.isFinite(entry.longitude)) {
    return readAddressHistory(field);
  }
  const existing = readAddressHistory(field)
    .filter((old) => old.address !== entry.address);
  const next = [entry, ...existing].slice(0, ADDRESS_HISTORY_LIMIT);
  try {
    wx.setStorageSync(addressHistoryKey(field), next);
  } catch (err) {
    /* storage failures should not block selecting an address */
  }
  return next;
}

function buildEndpointDisplay(item) {
  item = item || {};
  const name = String(item.name || '').trim();
  const rawAddress = String(item.address || '').trim();
  const rawDetail = String(item.detail || '').trim();
  const address = rawAddress || rawDetail || name;
  const detail = rawDetail || rawAddress || '';
  const displayName = name || address || '已选择位置';
  const displayDetail = detail && detail !== displayName ? detail : '';
  const displayAddress = displayDetail ? `${displayName} · ${displayDetail}` : displayName;
  return {
    name,
    address,
    detail,
    displayName,
    displayDetail,
    displayAddress
  };
}

function endpointForPublish(endpoint) {
  const display = buildEndpointDisplay(endpoint);
  return {
    ...endpoint,
    name: display.displayName,
    address: display.displayAddress,
    detail: display.displayDetail || display.detail
  };
}
