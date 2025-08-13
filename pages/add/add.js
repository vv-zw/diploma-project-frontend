Page({
  data: {
    name: '',
    score: 5,
    scores: [1, 2, 3, 4, 5],
    types: ['电影', '剧集', '综艺', '待看'], // 包含待看类型
    typeIndex: 0,
    comment: '',
    elements: ['古装', '爱情', '战争', '谍战', '悬疑', '恐怖', '家庭', '搞笑', '警匪', '动画', '剧情', '纪录片', '科幻', '国产剧', '美剧', '韩剧', '热门'],
    selectedElements: [],
    showElements: true
  },

  // 表单输入处理
  inputName(e) {
    this.setData({ name: e.detail.value.trim() });
  },

  changeType(e) {
    this.setData({ typeIndex: e.detail.value });
  },

  changeScore(e) {
    this.setData({ score: this.data.scores[e.detail.value] });
  },

  inputComment(e) {
    this.setData({ comment: e.detail.value });
  },

  checkboxChange(e) {
    this.setData({ selectedElements: e.detail.value });
  },

  // 保存数据
  save() {
    const { name, score, types, typeIndex, comment, selectedElements } = this.data;
    
    // 表单验证
    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }
    
    if (selectedElements.length === 0) {
      wx.showToast({ title: '请至少选择一个分类', icon: 'none' });
      return;
    }

    // 构建新数据对象
    const newItem = {
      id: Date.now().toString(),
      name,
      score,
      type: types[typeIndex],
      comment,
      selectedElements: [...selectedElements],
      createTime: new Date().toISOString()
    };

    try {
      // 1. 保存到总列表
      const totalList = wx.getStorageSync('totalMovieList') || [];
      totalList.push(newItem);
      wx.setStorageSync('totalMovieList', totalList);
      
      // 2. 保存到对应分类列表
      const categoryKey = {
        '电影': 'movieList',
        '剧集': 'showList',
        '综艺': 'reactionList',
        '待看': 'alreadyList'
      }[newItem.type];
      
      if (categoryKey) {
        const categoryList = wx.getStorageSync(categoryKey) || [];
        categoryList.push(newItem);
        wx.setStorageSync(categoryKey, categoryList);
      }

      wx.showToast({ title: '保存成功', icon: 'success' });
      
      // 仅重置表单，不返回上一页（关键修改）
      this.resetForm();
      
    } catch (error) {
      console.error('保存失败:', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },
  
  // 重置表单（保持原有逻辑不变）
  resetForm() {
    this.setData({
      name: '',
      score: 5,
      comment: '',
      selectedElements: [],
      showElements: false
    }, () => {
      setTimeout(() => {
        this.setData({
          showElements: true,
          selectedElements: []
        });
      }, 100);
    });
  },

  // 返回上一页（保持原有逻辑不变）
  goBack() {
    wx.navigateBack();
  }
});