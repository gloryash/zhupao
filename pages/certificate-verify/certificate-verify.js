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
   * 验证证书
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

    // 从存储中查找证书
    const certificates = wx.getStorageSync('certificates') || [];
    const certificate = certificates.find(cert => cert.certificateNo === certificateNo);

    if (certificate) {
      this.setData({
        verifyResult: certificate,
        showResult: true
      });
    } else {
      this.setData({
        verifyResult: null,
        showResult: true
      });
    }
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
