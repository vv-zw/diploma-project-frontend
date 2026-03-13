// app.js (前端)
App({
  globalData: {
    backendUrl: 'http://localhost:5000', // 确保与后端地址一致
    userInfo: null
  },
  
  onLaunch() {
    // 初始化时检查本地数据并同步
    this.checkAndSyncData();
  },
  
  // 检查本地数据并同步
  checkAndSyncData() {
    const movieList = wx.getStorageSync('movieList') || [];
    const seriesList = wx.getStorageSync('seriesList') || [];
    
    console.log('本地电影数据:', movieList.length, '条');
    console.log('本地剧集数据:', seriesList.length, '条');
    
    // 仅当有数据时才同步，避免空数据覆盖
    if (movieList.length > 0 || seriesList.length > 0) {
      this.syncUserData();
    } else {
      console.log('无本地数据，不进行同步');
    }
  },
  
  // 同步用户数据到后端
  syncUserData() {
    const movieList = wx.getStorageSync('movieList') || [];
    const seriesList = wx.getStorageSync('seriesList') || [];
    
    // 过滤无效数据并规范化格式
    const validMovies = movieList
      .filter(item => item && item.title && item.genres)
      .map(item => ({
        id: item.id || `movie_${Date.now()}`,
        name: item.title,
        genres: Array.isArray(item.genres) ? 
                item.genres : 
                item.genres.split(',').map(g => g.trim()),
        rating: item.rating || 0,
        cover_url: item.cover_url || ''
      }));
    
    const validSeries = seriesList
      .filter(item => item && item.title && item.genres)
      .map(item => ({
        id: item.id || `series_${Date.now()}`,
        name: item.title,
        genres: Array.isArray(item.genres) ? 
                item.genres : 
                item.genres.split(',').map(g => g.trim()),
        rating: item.rating || 0,
        cover_url: item.cover_url || ''
      }));
    
    const preferences = [...validMovies, ...validSeries];
    
    if (preferences.length === 0) {
      console.log('无有效数据可同步');
      return;
    }
    
    // 发送数据到后端
    wx.request({
      url: `${this.globalData.backendUrl}/sync-user-data`,
      method: 'POST',
      data: { preferences },
      header: {
        'Content-Type': 'application/json'  // 确保正确的Content-Type
      },
      success: (res) => {
        if (res.data.code === 0) {
          console.log('数据同步成功');
          console.log('标签权重:', res.data.count_weights);
          console.log('保存的偏好数量:', res.data.saved_preferences_count);
        } else {
          console.error('同步失败:', res.data.error);
        }
      },
      fail: (err) => {
        console.error('请求失败:', err);
      }
    });
  }
});