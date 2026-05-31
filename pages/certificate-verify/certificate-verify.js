const app = getApp();

Page({
  data: {
    certificateNo: '',
    verifyResult: null,
    showResult: false
  },

  /**
   * 证书编号输入
   */
  onCertificateNoInput(e) {
    this.setData({
      certificateNo: e.detail.value
    });
  },

  /**
   * 验证证书（云端优先）
   */
  verifyCertificate() {
    const { certificateNo } = this.data;

    if (!certificateNo.trim()) {
      wx.showToast({
        title: '请输入证书编号',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '验证中...' });

    // 云端验证
    app.verifyCertificate(certificateNo).then(res => {
      wx.hideLoading();
      if (res.success) {
        this.setData({
          verifyResult: res.certificate,
          showResult: true
        });
      } else {
        this.setData({ verifyResult: null, showResult: true });
      }
    }).catch(() => {
      wx.hideLoading();
      // 降级本地验证
      const certificates = wx.getStorageSync('certificates') || [];
      const certificate = certificates.find(cert => cert.certificateNo === certificateNo);
      this.setData({
        verifyResult: certificate || null,
        showResult: true
      });
    });
  },

  /**
   * 重新验证
   */
  resetVerify() {
    this.setData({
      certificateNo: '',
      verifyResult: null,
      showResult: false
    });
  }
})
