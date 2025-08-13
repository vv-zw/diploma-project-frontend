// pages/setting/setting.js
Page({
  data: {
    theme: 'light', // 默认浅色主题
    notifications: true, // 通知开关
    recommendMode: 'auto', // 推荐模式：自动/手动
    cacheSize: '0 MB' // 缓存大小
  },

  onLoad() {
    // 加载已保存的设置
    this.loadSettings();
    // 计算缓存大小
    this.calculateCacheSize();
  },

  // 加载本地保存的设置
  loadSettings() {
    const savedSettings = wx.getStorageSync('appSettings') || {};
    this.setData({
      theme: savedSettings.theme || 'light',
      notifications: savedSettings.notifications !== undefined ? savedSettings.notifications : true,
      recommendMode: savedSettings.recommendMode || 'auto'
    });
  },

  // 切换主题
  toggleTheme(e) {
    const theme = e.detail.value ? 'dark' : 'light';
    this.setData({ theme });
    wx.setStorageSync('appSettings', { ...this.data, theme });
    
    // 可以在这里添加主题切换的UI效果
    wx.showToast({
      title: `${theme === 'dark' ? '深色' : '浅色'}主题已启用`,
      icon: 'none'
    });
  },

  // 切换通知开关
  toggleNotifications(e) {
    const notifications = e.detail.value;
    this.setData({ notifications });
    wx.setStorageSync('appSettings', { ...this.data, notifications });
  },

  // 切换推荐模式
  changeRecommendMode(e) {
    const recommendMode = e.detail.value;
    this.setData({ recommendMode });
    wx.setStorageSync('appSettings', { ...this.data, recommendMode });
  },

  // 计算缓存大小
  calculateCacheSize() {
    wx.getStorageInfo({
      success: (res) => {
        const size = (res.currentSize / 1024).toFixed(2);
        this.setData({ cacheSize: `${size} MB` });
      },
      fail: () => {
        this.setData({ cacheSize: '获取失败' });
      }
    });
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有本地缓存吗？',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorage({
            success: () => {
              this.setData({ cacheSize: '0 MB' });
              wx.showToast({ title: '缓存已清除', icon: 'success' });
            },
            fail: () => {
              wx.showToast({ title: '清除失败', icon: 'none' });
            }
          });
        }
      }
    });
  },

  // 返回上一页
  goBack() {
    wx.navigateBack();
  }
});