const api = require('../../utils/api');
const session = require('../../utils/session');
const safeArea = require('../../utils/safe-area');
const { speakVoiceCue } = require('../../utils/voice-player');

const DEMO_ACCOUNTS = {
  disabled: {
    identifier: 'e2e.blind.1780200869@example.com',
    password: 'Passw0rd!1780200869'
  },
  volunteer: {
    identifier: 'e2e.volunteer.1780200869@example.com',
    password: 'Passw0rd!1780200869'
  }
};

Page({
  data: {
    mode: 'login',
    role: 'disabled',
    submitting: false,
    showPassword: false,
    error: '',
    voiceCue: '',

    identifier: '',
    password: '',
    nickName: '',
    phone: '',
    name: '',
    runningLocation: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    runningYears: '',
    pace: '',
    hasMarathon: 'no',
    hasFirstAid: 'no',
    hasCompanionExp: 'no',
    shellStyle: ''
  },

  onLoad() {
    this.setData({ shellStyle: safeArea.getSafeAreaStyle() });
    if (session.getSession()) {
      wx.reLaunch({ url: '/pages/home/home' });
    }
  },

  setMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ mode, error: '' });
    this.announce(mode === 'register' ? '注册' : '登录');
  },

  setRole(e) {
    const role = e.currentTarget.dataset.role;
    this.setData({ role, error: '' });
    this.announce(role === 'volunteer' ? '我是陪跑志愿者' : '我是视障跑者');
  },

  togglePassword() {
    const showPassword = !this.data.showPassword;
    this.setData({ showPassword });
    this.announce(showPassword ? '密码已显示' : '密码已隐藏');
  },

  onInput(e) {
    const key = e.currentTarget.dataset.key;
    this.setData({ [key]: e.detail.value });
  },

  setYesNo(e) {
    const key = e.currentTarget.dataset.key;
    const value = e.currentTarget.dataset.value;
    this.setData({ [key]: value });
    const labels = {
      hasMarathon: value === 'yes' ? '有马拉松经历' : '无马拉松经历',
      hasFirstAid: value === 'yes' ? '持有急救证书' : '未持有急救证书',
      hasCompanionExp: value === 'yes' ? '有陪跑经验' : '无陪跑经验'
    };
    this.announce(labels[key]);
  },

  async quickExperience(e) {
    const role = e.currentTarget.dataset.role;
    const account = DEMO_ACCOUNTS[role];
    await this.loginWith(account.identifier, account.password);
  },

  async submit() {
    const identifier = this.data.identifier.trim();
    const password = this.data.password;
    if (!identifier || !password) {
      this.fail('请输入邮箱/手机号和密码');
      return;
    }
    if (this.data.mode === 'register') {
      if (!this.data.nickName.trim()) {
        this.fail('请填写一个昵称');
        return;
      }
      const phone = registrationPhone(identifier, this.data.phone);
      if (!/^1\d{10}$/.test(phone)) {
        this.fail('请填写有效的手机号码');
        return;
      }
      await this.registerWith(identifier, password, this.buildProfile());
      return;
    }
    await this.loginWith(identifier, password);
  },

  async loginWith(identifier, password) {
    if (this.data.submitting) return;
    this.setData({ submitting: true, error: '' });
    wx.showLoading({ title: '登录中...' });
    try {
      const next = await api.loginAccount(identifier, password);
      session.applySession(next);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      this.fail(err.message || '登录失败，请稍后再试');
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  async registerWith(identifier, password, profile) {
    if (this.data.submitting) return;
    this.setData({ submitting: true, error: '' });
    wx.showLoading({ title: '创建中...' });
    try {
      const next = await api.registerAccount(identifier, password, profile);
      session.applySession(next);
      wx.reLaunch({ url: '/pages/home/home' });
    } catch (err) {
      this.fail(err.message || '注册失败，请稍后再试');
    } finally {
      wx.hideLoading();
      this.setData({ submitting: false });
    }
  },

  buildProfile() {
    const d = this.data;
    const profile = {
      userType: d.role,
      nickName: d.nickName.trim(),
      phone: registrationPhone(d.identifier, d.phone)
    };
    if (d.name.trim()) profile.name = d.name.trim();
    if (d.runningLocation.trim()) profile.runningLocation = d.runningLocation.trim();
    if (d.role === 'disabled') {
      if (d.emergencyName.trim()) profile.emergencyName = d.emergencyName.trim();
      if (d.emergencyPhone.trim()) profile.emergencyPhone = d.emergencyPhone.trim();
      if (d.emergencyRelation.trim()) profile.emergencyRelation = d.emergencyRelation.trim();
    } else {
      if (d.runningYears.trim()) profile.runningYears = d.runningYears.trim();
      if (d.pace.trim()) profile.pace = d.pace.trim();
      profile.hasMarathon = d.hasMarathon;
      profile.hasFirstAid = d.hasFirstAid;
      profile.hasCompanionExp = d.hasCompanionExp;
    }
    return profile;
  },

  fail(message) {
    this.setData({ error: message });
    this.announce(message);
    wx.showToast({ title: message, icon: 'none' });
  },

  announceTap(e) {
    const dataset = (e && e.currentTarget && e.currentTarget.dataset) || {};
    const voice = dataset.voice;
    this.announce(voice);
  },

  announce(message) {
    const text = String(message || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    this.setData({ voiceCue: text });
    speakVoiceCue(text);
  }
});

function registrationPhone(identifier, phone) {
  const normalized = String(identifier || '').replace(/\s+/g, '').trim();
  if (/^1\d{10}$/.test(normalized)) return normalized;
  return String(phone || '').replace(/\s+/g, '').trim();
}
