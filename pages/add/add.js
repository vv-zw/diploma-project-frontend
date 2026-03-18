Page({
  data: {
    name: '',
    score: 5,
    scoreIndex: 4,
    scores: [1, 2, 3, 4, 5],
    types: ['电影', '剧集', '综艺', '待看电影', '待看剧集'],
    typeIndex: 0,
    comment: '',
    elements: ['古装', '爱情', '战争', '谍战', '悬疑', '恐怖', '家庭', '搞笑', '警匪', '动画', '剧情', '纪录片', '科幻', '国产剧', '美剧', '韩剧', '热门'],
    selectedElements: [],
    showElements: true
  },

  inputName(e) {
    this.setData({ name: e.detail.value.trim() });
  },

  changeType(e) {
    this.setData({ typeIndex: Number(e.detail.value) });
  },

  changeScore(e) {
    const scoreIndex = Number(e.detail.value);
    this.setData({
      scoreIndex,
      score: this.data.scores[scoreIndex]
    });
  },

  inputComment(e) {
    this.setData({ comment: e.detail.value });
  },

  checkboxChange(e) {
    this.setData({ selectedElements: e.detail.value || [] });
  },

  getCategoryKey(type) {
    return {
      电影: 'movieList',
      剧集: 'showList',
      综艺: 'reactionList',
      待看电影: 'alreadyList',
      待看剧集: 'alreadyList'
    }[type] || '';
  },

  getContentType(type) {
    return {
      电影: 'movie',
      剧集: 'series',
      待看电影: 'movie',
      待看剧集: 'series'
    }[type] || '';
  },

  isWatchlistType(type) {
    return type === '待看电影' || type === '待看剧集';
  },

  persistToCategoryList(key, item) {
    if (!key) {
      return;
    }

    const list = wx.getStorageSync(key) || [];
    list.push(item);
    wx.setStorageSync(key, list);

    if (key === 'showList') {
      wx.setStorageSync('seriesList', list);
    }
  },

  buildNewItem() {
    const { name, score, types, typeIndex, comment, selectedElements } = this.data;
    const selectedType = types[typeIndex];
    const contentType = this.getContentType(selectedType);

    return {
      id: Date.now().toString(),
      name,
      title: name,
      score,
      rating: score,
      type: selectedType,
      content_type: contentType,
      comment,
      genres: [...selectedElements],
      selectedElements: [...selectedElements],
      createTime: new Date().toISOString()
    };
  },

  save() {
    const { name, types, typeIndex, selectedElements } = this.data;
    const selectedType = types[typeIndex];

    if (!name) {
      wx.showToast({ title: '请输入名称', icon: 'none' });
      return;
    }

    if (!selectedElements.length) {
      wx.showToast({ title: '请至少选择一个分类', icon: 'none' });
      return;
    }

    const newItem = this.buildNewItem();
    const contentType = this.getContentType(selectedType);

    try {
      if (this.isWatchlistType(selectedType)) {
        this.saveWatchlistItem(newItem, contentType);
        return;
      }

      const totalList = wx.getStorageSync('totalMovieList') || [];
      totalList.push(newItem);
      wx.setStorageSync('totalMovieList', totalList);

      const categoryKey = this.getCategoryKey(selectedType);
      this.persistToCategoryList(categoryKey, newItem);

      this.resetForm();
      this.syncAfterSave(contentType);
    } catch (error) {
      console.error('save_failed', error);
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    }
  },

  saveWatchlistItem(item, contentType) {
    const app = getApp();
    if (!app || typeof app.addWatchlistItem !== 'function') {
      wx.showToast({ title: '当前版本不支持待看同步', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在保存' });

    app.addWatchlistItem({
      ...item,
      type: contentType,
      content_type: contentType
    }).then(() => {
      this.resetForm();
      return app.syncAndRefresh(contentType, { silent: true }).catch(() => null);
    }).then(() => {
      wx.hideLoading();
      wx.showToast({ title: '已加入待看清单', icon: 'success' });
    }).catch((error) => {
      wx.hideLoading();
      console.error('save_watchlist_failed', error);
      wx.showToast({ title: '加入待看失败', icon: 'none' });
    });
  },

  syncAfterSave(contentType) {
    const app = getApp();
    wx.showLoading({ title: '正在同步' });

    const onSuccess = () => {
      wx.hideLoading();
      wx.showToast({
        title: contentType ? '已保存并刷新推荐' : '已保存',
        icon: 'success'
      });
    };

    const onFail = () => {
      wx.hideLoading();
      wx.showToast({
        title: '本地已保存，稍后再同步',
        icon: 'none'
      });
    };

    if (!app || typeof app.syncUserData !== 'function') {
      onFail();
      return;
    }

    if (contentType && typeof app.syncAndRefresh === 'function') {
      app.syncAndRefresh(contentType, {
        onSuccess,
        onFail
      });
      return;
    }

    app.syncUserData({
      onSuccess,
      onFail
    });
  },

  resetForm() {
    this.setData({
      name: '',
      score: 5,
      scoreIndex: 4,
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

  goBack() {
    wx.navigateBack();
  }
});
