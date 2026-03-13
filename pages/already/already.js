Page({
  data: {
    alreadyList: [], // 待看列表数据
    rowCount: 0,     // 用于网格布局的行数计算
    loading: true    // 加载状态
  },

  onLoad() {
    // 页面加载时优先从本地缓存读取数据
    this.loadFromLocalCache();
    
    // 如果是首次加载或数据需要更新，重新加载
    if (!this.checkLocalDataValid()) {
      this.loadAlreadyData();
    } else {
      this.setData({ loading: false });
    }
  },

  onShow() {
    // 检查是否有数据变更标记
    const hasDataChanged = wx.getStorageSync('alreadyDataChanged') || false;
    
    if (hasDataChanged) {
      // 数据有变更，重新加载
      this.loadAlreadyData();
      // 清除变更标记
      wx.removeStorageSync('alreadyDataChanged');
    } else {
      // 数据无变更，使用缓存
      this.loadFromLocalCache();
    }
  },

  // 更新行数计算（用于网格布局）
  updateRowCount() {
    const rowCount = Math.ceil((this.data.alreadyList.length || 0) / 2);
    this.setData({ rowCount });
    console.log('更新待看列表行数:', rowCount);
  },

  // 从本地缓存加载数据
  loadFromLocalCache() {
    // 加载待看列表缓存
    let alreadyData = wx.getStorageSync('alreadyList') || [];
    
    // 格式化数据
    alreadyData = this.formatAlreadyData(alreadyData);
    
    this.setData({
      alreadyList: alreadyData,
      loading: false
    });
    
    // 更新行数
    this.updateRowCount();
    
    console.log('从本地缓存加载待看数据，数量:', alreadyData.length);
  },

  // 检查本地数据是否有效
  checkLocalDataValid() {
    const cacheTime = wx.getStorageSync('alreadyCacheTimestamp') || 0;
    const alreadyList = wx.getStorageSync('alreadyList') || [];
    
    // 缓存有效期为30分钟
    const CACHE_DURATION = 1800000; // 毫秒
    
    // 检查条件：有缓存时间、未过期、有数据
    return cacheTime > 0 && 
           (Date.now() - cacheTime) < CACHE_DURATION && 
           alreadyList.length > 0;
  },

  // 保存数据到本地缓存
  saveToLocalCache() {
    wx.setStorageSync('alreadyCacheTimestamp', Date.now());
    console.log('待看数据已保存到本地缓存');
  },

  // 标记数据已变更
  markDataChanged() {
    wx.setStorageSync('alreadyDataChanged', true);
  },

  // 格式化待看数据
  formatAlreadyData(data) {
    return data.map(item => {
      let elements = item.selectedElements || [];
      // 如果是字符串（如 "爱情,搞笑"），拆分为数组
      if (typeof elements === 'string') {
        elements = elements.split(',');
      }
      return {
        ...item,
        selectedElements: elements
      };
    });
  },

  // 加载待看列表数据（与电影页完全一致的逻辑）
  loadAlreadyData() {
    this.setData({ loading: true });
    
    let alreadyData = wx.getStorageSync('alreadyList') || [];
    
    // 格式化数据
    alreadyData = this.formatAlreadyData(alreadyData);
    
    console.log("修复后的待看元素:", alreadyData[0]?.selectedElements); // 调试用
    
    this.setData({ 
      alreadyList: alreadyData,
      loading: false 
    });
    
    // 更新行数
    this.updateRowCount();
    
    // 保存到缓存
    this.saveToLocalCache();
  },

  // 删除待看项
  deleteAlready(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要从待看列表中删除吗？',
      success: (res) => {
        if (res.confirm) {
          // 标记数据已变更
          this.markDataChanged();
          
          const newAlreadyList = this.data.alreadyList.filter(item => item.id !== id);
          this.setData({ alreadyList: newAlreadyList });
          wx.setStorageSync('alreadyList', newAlreadyList);
          
          // 更新行数
          this.updateRowCount();
          
          // 同步删除总列表
          const totalList = wx.getStorageSync('totalMovieList') || [];
          wx.setStorageSync('totalMovieList', totalList.filter(item => item.id !== id));
          
          wx.showToast({ title: '删除成功', icon: 'none' });
        }
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.markDataChanged();
    this.loadAlreadyData();
    wx.stopPullDownRefresh();
  },

  // 添加到待看列表的辅助方法（如果需要）
  addToAlready(item) {
    this.markDataChanged();
    
    const alreadyList = this.data.alreadyList || [];
    alreadyList.push(item);
    
    this.setData({ alreadyList });
    wx.setStorageSync('alreadyList', alreadyList);
    
    // 更新行数
    this.updateRowCount();
    
    wx.showToast({ title: '已添加到待看列表', icon: 'success' });
  }
});