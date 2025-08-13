Page({
  data: {
    alreadyList: [] // 待看列表数据
  },

  onLoad() {
    this.loadAlreadyData();
  },

  onShow() {
    this.loadAlreadyData(); // 确保从其他页面返回时刷新数据
  },

  // 加载待看列表数据（与电影页完全一致的逻辑）
  loadAlreadyData() {
    let alreadyData = wx.getStorageSync('alreadyList') || [];
    
    // 关键：强制将 selectedElements 转为数组
    alreadyData = alreadyData.map(item => {
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
    
    console.log("修复后的待看元素:", alreadyData[0]?.selectedElements); // 调试用
    this.setData({ alreadyList: alreadyData });
  },

  // 删除待看项（方法名与电影页一致：deleteMovie → deleteAlready）
  deleteAlready(e) {
    const id = e.currentTarget.dataset.id;
    const newAlreadyList = this.data.alreadyList.filter(item => item.id !== id);
    this.setData({ alreadyList: newAlreadyList });
    wx.setStorageSync('alreadyList', newAlreadyList);
    
    // 同步删除总列表
    const totalList = wx.getStorageSync('totalMovieList') || [];
    wx.setStorageSync('totalMovieList', totalList.filter(item => item.id !== id));
    
    wx.showToast({ title: '删除成功', icon: 'none' });
  }
});