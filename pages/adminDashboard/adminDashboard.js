Page({
  data: {
    stats: null,
    loading: true,
    error: ''
  },

  onShow() {
    this.fetchDashboard();
  },

  getBackendUrl() {
    const app = getApp();
    return (app && typeof app.getBackendUrl === 'function')
      ? app.getBackendUrl()
      : 'http://localhost:5000';
  },

  getAdminHeader() {
    return {
      'Content-Type': 'application/json',
      'X-Admin-Token': wx.getStorageSync('adminToken') || ''
    };
  },

  handleUnauthorized() {
    wx.removeStorageSync('adminToken');
    wx.removeStorageSync('adminUsername');
    wx.redirectTo({ url: '/pages/adminLogin/adminLogin' });
  },

  fetchDashboard() {
    this.setData({ loading: true, error: '' });
    wx.request({
      url: `${this.getBackendUrl()}/api/admin/dashboard`,
      header: this.getAdminHeader(),
      success: (res) => {
        if (res.statusCode === 401) {
          this.handleUnauthorized();
          return;
        }

        if (res.data && res.data.code === 0) {
          this.setData({ stats: res.data.data, loading: false });
          return;
        }

        this.setData({
          loading: false,
          error: (res.data && res.data.error) || '加载失败'
        });
      },
      fail: () => {
        this.setData({ loading: false, error: '网络错误，加载失败' });
      }
    });
  },

  goToContent() {
    wx.navigateTo({ url: '/pages/adminContent/adminContent' });
  },

  refreshRecommendations(e) {
    const type = e.currentTarget.dataset.type || '';
    wx.showLoading({ title: '正在刷新' });
    wx.request({
      url: `${this.getBackendUrl()}/api/admin/refresh`,
      method: 'POST',
      data: type ? { type } : {},
      header: this.getAdminHeader(),
      success: (res) => {
        wx.hideLoading();
        if (res.statusCode === 401) {
          this.handleUnauthorized();
          return;
        }

        if (res.data && res.data.code === 0) {
          wx.showToast({ title: '刷新完成', icon: 'success' });
          this.fetchDashboard();
          return;
        }

        wx.showToast({ title: '刷新失败', icon: 'none' });
      },
      fail: () => {
        wx.hideLoading();
        wx.showToast({ title: '网络错误', icon: 'none' });
      }
    });
  },

  logout() {
    wx.removeStorageSync('adminToken');
    wx.removeStorageSync('adminUsername');
    wx.redirectTo({ url: '/pages/setting/setting' });
  }
  
});
