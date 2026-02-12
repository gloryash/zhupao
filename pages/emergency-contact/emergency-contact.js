const app = getApp();

Page({
  data: {
    userType: '',
    emergencyName: '',
    emergencyPhone: '',
    emergencyRelation: '',
    relations: ['父母', '子女', '配偶', '兄弟姐妹', '朋友', '其他'],
    relationIndex: 0,
    notes: '',
    hasEmergencyContact: false
  },

  onLoad() {
    this.loadEmergencyContact();
  },

  onShow() {
    this.loadEmergencyContact();
  },

  /**
   * 加载已保存的紧急联系人信息（云端优先）
   */
  loadEmergencyContact() {
    const currentUserType = wx.getStorageSync('currentUserType') || 'disabled';
    this.setData({ userType: currentUserType });

    // 先从本地缓存快速显示
    const localContact = wx.getStorageSync(`emergencyContact_${currentUserType}`);
    if (localContact) {
      this._setContactData(localContact);
    }

    // 从云端获取最新数据
    app.getEmergencyContact().then(res => {
      if (res.success && res.emergencyContact && res.emergencyContact.phone) {
        this._setContactData(res.emergencyContact);
        // 同步到本地缓存
        wx.setStorageSync(`emergencyContact_${currentUserType}`, res.emergencyContact);
      }
    }).catch(() => {});
  },

  /**
   * 设置联系人数据到页面
   */
  _setContactData(contact) {
    let relationIndex = 0;
    const relations = this.data.relations;
    for (let i = 0; i < relations.length; i++) {
      if (relations[i] === contact.relation) {
        relationIndex = i;
        break;
      }
    }
    this.setData({
      emergencyName: contact.name || '',
      emergencyPhone: contact.phone || '',
      emergencyRelation: contact.relation || '',
      relationIndex: relationIndex,
      notes: contact.notes || '',
      hasEmergencyContact: true
    });
  },

  /**
   * 紧急联系人姓名输入
   */
  onNameInput(e) {
    this.setData({
      emergencyName: e.detail.value
    });
  },

  /**
   * 紧急联系人电话输入
   */
  onPhoneInput(e) {
    this.setData({
      emergencyPhone: e.detail.value
    });
  },

  /**
   * 关系选择
   */
  onRelationChange(e) {
    const relation = this.data.relations[e.detail.value];
    this.setData({
      relationIndex: e.detail.value,
      emergencyRelation: relation
    });
  },

  /**
   * 备注输入
   */
  onNotesInput(e) {
    this.setData({
      notes: e.detail.value
    });
  },

  /**
   * 表单验证
   */
  validateForm() {
    const { emergencyName, emergencyPhone } = this.data;

    if (!emergencyName.trim()) {
      wx.showToast({
        title: '请输入紧急联系人姓名',
        icon: 'none'
      });
      return false;
    }

    if (!emergencyPhone.trim()) {
      wx.showToast({
        title: '请输入紧急联系人电话',
        icon: 'none'
      });
      return false;
    }

    // 验证手机号格式
    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(emergencyPhone)) {
      wx.showToast({
        title: '请输入正确的手机号',
        icon: 'none'
      });
      return false;
    }

    return true;
  },

  /**
   * 保存紧急联系人（同步到云端）
   */
  saveEmergencyContact() {
    if (!this.validateForm()) return;

    const { userType, emergencyName, emergencyPhone, emergencyRelation, notes } = this.data;
    const relation = emergencyRelation || this.data.relations[this.data.relationIndex];

    const emergencyContact = {
      name: emergencyName,
      phone: emergencyPhone,
      relation: relation,
      notes: notes,
      updatedAt: new Date().toLocaleString()
    };

    // 保存到本地存储（即时生效）
    wx.setStorageSync(`emergencyContact_${userType}`, emergencyContact);

    // 同步到云端
    wx.showLoading({ title: '保存中...' });
    app.updateEmergencyContact({
      emergencyName: emergencyName,
      emergencyPhone: emergencyPhone,
      emergencyRelation: relation
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
      setTimeout(() => { wx.navigateBack({ delta: 1 }); }, 1500);
    }).catch(() => {
      wx.hideLoading();
      // 本地已保存，提示成功
      wx.showToast({ title: '保存成功', icon: 'success', duration: 1500 });
      setTimeout(() => { wx.navigateBack({ delta: 1 }); }, 1500);
    });
  },

  /**
   * 删除紧急联系人
   */
  deleteEmergencyContact() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除紧急联系人信息吗？',
      confirmText: '删除',
      confirmColor: '#ef4444',
      success: (res) => {
        if (res.confirm) {
          const userType = this.data.userType;
          wx.removeStorageSync(`emergencyContact_${userType}`);

          this.setData({
            emergencyName: '',
            emergencyPhone: '',
            emergencyRelation: '',
            relationIndex: 0,
            notes: '',
            hasEmergencyContact: false
          });

          wx.showToast({
            title: '已删除',
            icon: 'success'
          });
        }
      }
    });
  },

  /**
   * 拨打电话
   */
  callEmergency() {
    const { emergencyPhone } = this.data;

    if (!emergencyPhone) {
      wx.showToast({
        title: '暂无紧急联系人电话',
        icon: 'none'
      });
      return;
    }

    wx.makePhoneCall({
      phoneNumber: emergencyPhone
    });
  }
});
