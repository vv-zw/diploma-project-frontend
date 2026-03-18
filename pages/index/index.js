Page({
  data: {
    movieList: []
  },

  getDefaultCover(item = {}) {
    const rawType = String(item.content_type || item.type || '').toLowerCase();
    const isSeries = rawType === 'series' || rawType === 'show' || item.type === '剧集';
    return isSeries
      ? 'https://via.placeholder.com/240x320/e9dccb/6f5640?text=Series'
      : 'https://via.placeholder.com/240x320/f0dfd1/8c4b3f?text=Movie';
  },

  normalizeMovieList(list = []) {
    return (list || []).map((item) => {
      const coverUrl = item.coverUrl || item.cover_url || item.image || '';
      return {
        ...item,
        name: item.name || item.title || '未命名影视',
        score: item.score || item.rating || '暂无',
        comment: item.comment || '还没有留下简介或观影感受。',
        displayCover: coverUrl || this.getDefaultCover(item)
      };
    });
  },

  loadMovieList() {
    const list = wx.getStorageSync('totalMovieList') || [];
    this.setData({ movieList: this.normalizeMovieList(list) });
  },

  onLoad() {
    this.fetchSystemInfo();
    this.loadMovieList();
  },

  onShow() {
    this.loadMovieList();
  },

  fetchSystemInfo() {
    wx.request({
      url: 'http://localhost:5000/api/system-info',
      success: (res) => {
        console.log('后端连接成功:', res.data);
      },
      fail: (err) => {
        console.error('后端连接失败:', err);
        wx.showToast({
          title: '后端服务未启动',
          icon: 'none'
        });
      }
    });
  },

  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  goToRecommend() {
    wx.navigateTo({ url: '/pages/recommend/recommend' });
  },

  goSetting() {
    wx.navigateTo({ url: '/pages/setting/setting' });
  },

  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    const newList = this.data.movieList.filter((item) => item.id !== id);
    this.setData({ movieList: newList });
    wx.setStorageSync('totalMovieList', newList);
    this.syncCategoryLists();

    wx.showToast({ title: '已删除', icon: 'none' });
  },

  syncCategoryLists() {
    const allItems = wx.getStorageSync('totalMovieList') || [];
    const categories = {
      电影: 'movieList',
      剧集: 'showList',
      综艺: 'reactionList',
      待看: 'alreadyList'
    };

    for (const [type, key] of Object.entries(categories)) {
      const filtered = allItems.filter((item) => item.type === type);
      wx.setStorageSync(key, filtered);
    }
  },

  showAll() {
    wx.navigateTo({ url: '/pages/all/all' });
  },

  filterMovie() {
    wx.navigateTo({ url: '/pages/movie/movie' });
  },

  filterShow() {
    wx.navigateTo({ url: '/pages/show/show' });
  },

  filterReaction() {
    wx.navigateTo({ url: '/pages/reaction/reaction' });
  },

  filterAlready() {
    wx.navigateTo({ url: '/pages/already/already' });
  },

  handleCoverError(e) {
    const { id } = e.currentTarget.dataset;
    const fallbackList = this.data.movieList.map((item) => {
      if (item.id !== id) {
        return item;
      }

      return {
        ...item,
        displayCover: this.getDefaultCover(item)
      };
    });

    this.setData({ movieList: fallbackList });
  }
});
