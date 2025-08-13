Page({
  data: {
    reactionList: [] // 综艺列表数据
  },

  onLoad() {
    this.loadReactionData();
  },

  onShow() {
    this.loadReactionData();
  },

  // 加载综艺数据
  loadReactionData() {
    let reactionData = wx.getStorageSync('reactionList') || [];
    
    // 确保 selectedElements 是数组（处理可能的字符串格式）
    reactionData = reactionData.map(item => {
      let elements = item.selectedElements || [];
      if (typeof elements === 'string') {
        elements = elements.split(',');
      }
      return {
        ...item,
        selectedElements: elements
      };
    });
    
    console.log("修复后的综艺元素:", reactionData[0]?.selectedElements);
    this.setData({ reactionList: reactionData });
  },

  // 删除综艺
  deleteReaction(e) {
    const id = e.currentTarget.dataset.id;
    const newReactionList = this.data.reactionList.filter(item => item.id !== id);
    this.setData({ reactionList: newReactionList });
    wx.setStorageSync('reactionList', newReactionList);
    
    // 同步删除总列表
    const totalList = wx.getStorageSync('totalMovieList') || [];
    wx.setStorageSync('totalMovieList', totalList.filter(item => item.id !== id));
    
    wx.showToast({ title: '删除成功', icon: 'none' });
  }
});