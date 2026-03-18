Page({
  data: {
    username: 'admin',
    password: 'admin123',
    loading: false,
    error: ''
  },

  getBackendUrl() {
    const app = getApp();
    return (app && typeof app.getBackendUrl === 'function')
      ? app.getBackendUrl()
      : 'http://localhost:5000';
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value.trim(), error: '' });
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value, error: '' });
  },

  submitLogin() {
    const { username, password } = this.data;
    if (!username || !password) {
      this.setData({ error: '请输入账号和密码' });
      return;
    }

    this.setData({ loading: true, error: '' });
    wx.request({
      url: `${this.getBackendUrl()}/api/admin/login`,
      method: 'POST',
      data: { username, password },
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.data && res.data.code === 0 && res.data.token) {
          wx.setStorageSync('adminToken', res.data.token);
          wx.setStorageSync('adminUsername', res.data.username || username);
          wx.redirectTo({ url: '/pages/adminDashboard/adminDashboard' });
          return;
        }

        this.setData({
          loading: false,
          error: (res.data && res.data.error) || '登录失败'
        });
      },
      fail: () => {
        this.setData({
          loading: false,
          error: '网络错误，登录失败'
        });
      }
    });
  }
});
