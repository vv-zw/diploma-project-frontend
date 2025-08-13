Page({
  data: {
    totalList: [] // 全部影视数据
  },

  onLoad() {
    this.loadTotalData();
  },

  onShow() {
    this.loadTotalData();
  },

  // 加载全部数据
  loadTotalData() {
    let totalData = wx.getStorageSync('totalMovieList') || [];
    
    // 确保 selectedElements 是数组
    totalData = totalData.map(item => {
      let elements = item.selectedElements || [];
      if (typeof elements === 'string') {
        elements = elements.split(',');
      }
      return {
        ...item,
        selectedElements: elements
      };
    });
    
    console.log("修复后的全部元素:", totalData[0]?.selectedElements);
    this.setData({ totalList: totalData });
  },

  // 删除任意类型的项目
  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    const newTotalList = this.data.totalList.filter(item => item.id !== id);
    this.setData({ totalList: newTotalList });
    wx.setStorageSync('totalMovieList', newTotalList);
    
    // 根据类型同步删除对应分类列表
    const itemType = this.data.totalList.find(item => item.id === id)?.type;
    if (itemType) {
      const categoryKey = {
        '电影': 'movieList',
        '剧集': 'showList',
        '综艺': 'reactionList'
      }[itemType];
      
      if (categoryKey) {
        const categoryList = wx.getStorageSync(categoryKey) || [];
        wx.setStorageSync(categoryKey, categoryList.filter(item => item.id !== id));
      }
    }
    
    wx.showToast({ title: '删除成功', icon: 'none' });
  }
});