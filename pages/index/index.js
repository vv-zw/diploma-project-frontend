Page({
  data: {
    movieList: [] // 存储所有影视数据
  },

  // onLoad() {
  //   // 加载所有影视数据
  //   const list = wx.getStorageSync('totalMovieList') || [];
  //   this.setData({ movieList: list });
  // },

  // 跳转到添加页
  goAdd() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  // 跳转到推荐页
  goToRecommend() {
    wx.navigateTo({ url: '/pages/recommend/recommend' });
  },

  // 删除记录
  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    const newList = this.data.movieList.filter(item => item.id !== id);
    this.setData({ movieList: newList });
    wx.setStorageSync('totalMovieList', newList);
    
    // 同步更新各分类列表
    this.syncCategoryLists();
    
    wx.showToast({ title: '已删除', icon: 'none' });
  },

  // 同步各分类列表
  syncCategoryLists() {
    const allItems = wx.getStorageSync('totalMovieList') || [];
    
    // 按类型过滤并更新各分类列表
    const categories = {
      '电影': 'movieList',
      '剧集': 'showList',
      '综艺': 'reactionList',
      '待看': 'alreadyList' // 待看类型对应alreadyList
    };
    
    for (const [type, key] of Object.entries(categories)) {
      const filtered = allItems.filter(item => item.type === type);
      wx.setStorageSync(key, filtered);
    }
  },

  // 筛选并跳转
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

  // 待看清单跳转（绑定到already页面）
  filterAlready() {
    wx.navigateTo({ url: '/pages/already/already' });
  }
});