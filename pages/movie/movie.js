Page({
  data: {
    movieList: [],
    selectedElements: [],
    loading: true,
    syncStatus: "", // 同步状态提示（如"同步中..."）
    recommendList: [] // 实时存储推荐结果
  },

  onLoad() {
    // 页面加载时同时加载电影列表和推荐
    Promise.all([this.loadMovieData(), this.loadRecommendations()])
      .then(() => {
        this.setData({ loading: false });
      });
  },

  onShow() {
    // 页面显示时检查是否有更新（如从添加页返回）
    this.loadMovieData().then(() => {
      this.loadRecommendations();
    });
  },

  // 1. 加载电影数据并自动同步
  loadMovieData() {
    return new Promise((resolve) => {
      this.setData({ loading: true });
      
      // 从本地缓存加载
      const movieData = wx.getStorageSync('movieList') || [];
      this.setData({ movieList: movieData });
      
      // 同步到后端（带状态反馈）
      if (movieData.length > 0) {
        this.setData({ syncStatus: "同步中..." });
        this.syncToBackend().then(() => {
          this.setData({ syncStatus: "" });
          resolve();
        }).catch(() => {
          this.setData({ syncStatus: "同步失败，点击重试" });
          resolve();
        });
      } else {
        this.setData({ loading: false });
        resolve();
      }
    });
  },

  // 2. 实时同步到后端（核心优化）
  syncToBackend() {
    return new Promise((resolve, reject) => {
      const { movieList } = this.data;
      
      // 格式化需要同步的数据（仅包含必要字段）
      const preferences = movieList.map(movie => ({
        id: movie.id,
        name: movie.name,
        genres: movie.selectedElements, // 标签数组（如["爱情", "悬疑"]）
        rating: movie.rating || 0,
        cover_url: movie.coverUrl || ""
      }));

      wx.request({
        url: 'https://blue-groups-tan.loca.lt/sync-user-data', // 后端同步接口
        method: 'POST',
        data: { preferences },
        timeout: 10000, // 延长超时时间，确保同步完成
        success: (res) => {
          if (res.data.code === 0) {
            console.log("同步成功，新标签权重：", res.data.count_weights);
            resolve(res.data); // 同步成功后返回结果
          } else {
            console.error("同步失败：", res.data.error);
            reject(res.data.error);
          }
        },
        fail: (err) => {
          console.error("网络错误：", err);
          reject("网络异常，同步失败");
        }
      });
    });
  },

  // 3. 加载最新推荐（同步后立即调用）
  loadRecommendations() {
    return new Promise((resolve) => {
      this.setData({ loading: true });
      
      wx.request({
        url: 'https://blue-groups-tan.loca.lt/get_recommend',
        method: 'GET',
        data: { type: 'movie' },
        success: (res) => {
          if (res.data.code === 0) {
            this.setData({
              recommendList: res.data.data,
              loading: false
            });
          }
          resolve();
        },
        fail: () => {
          this.setData({ loading: false });
          resolve();
        }
      });
    });
  },

  // 4. 添加新电影（优化：添加后立即同步+更新推荐）
  addMovie() {
    wx.navigateTo({
      url: '/pages/add/add',
      // 返回当前页时立即刷新
      events: {
        onMovieAdded: () => {
          this.loadMovieData().then(() => {
            this.loadRecommendations();
          });
        }
      }
    });
  },

  // 5. 删除电影（优化：删除后立即同步+更新推荐）
  deleteMovie(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这部电影吗？',
      success: (res) => {
        if (res.confirm) {
          // 本地删除
          const newMovieList = this.data.movieList.filter(item => item.id !== id);
          this.setData({ movieList: newMovieList });
          wx.setStorageSync('movieList', newMovieList);
          
          // 立即同步并更新推荐
          this.setData({ syncStatus: "删除后同步中..." });
          this.syncToBackend()
            .then(() => {
              this.loadRecommendations(); // 同步成功后立即拉取新推荐
              this.setData({ syncStatus: "" });
              wx.showToast({ title: '删除并同步成功', icon: 'none' });
            })
            .catch((err) => {
              this.setData({ syncStatus: "同步失败：" + err });
            });
        }
      }
    });
  },

  // 6. 批量删除（同样优化实时同步）
  batchDelete() {
    const { selectedElements, movieList } = this.data;
    
    if (selectedElements.length === 0) {
      wx.showToast({ title: '请先选择要删除的电影', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认批量删除',
      content: `确定要删除选中的${selectedElements.length}部电影吗？`,
      success: (res) => {
        if (res.confirm) {
          // 本地删除
          const newMovieList = movieList.filter(item => !selectedElements.includes(item.id));
          this.setData({ 
            movieList: newMovieList,
            selectedElements: [] 
          });
          wx.setStorageSync('movieList', newMovieList);
          
          // 立即同步并更新推荐
          this.setData({ syncStatus: "批量删除后同步中..." });
          this.syncToBackend()
            .then(() => {
              this.loadRecommendations();
              this.setData({ syncStatus: "" });
              wx.showToast({ title: '批量删除并同步成功', icon: 'none' });
            })
            .catch((err) => {
              this.setData({ syncStatus: "同步失败：" + err });
            });
        }
      }
    });
  },

  // 7. 手动触发同步（用于同步失败时重试）
  retrySync() {
    this.setData({ syncStatus: "重试同步中..." });
    this.syncToBackend()
      .then(() => {
        this.loadRecommendations();
        this.setData({ syncStatus: "" });
        wx.showToast({ title: '同步成功', icon: 'none' });
      })
      .catch((err) => {
        this.setData({ syncStatus: "同步失败：" + err });
      });
  },

  // 跳转到推荐详情页
  goToRecommendDetail() {
    wx.navigateTo({
      url: '/pages/movieRecommend/movieRecommend',
      success: (res) => {
        // 传递当前推荐数据，避免重复请求
        res.eventChannel.emit('sendRecommendData', {
          recommendList: this.data.recommendList
        });
      }
    });
  }
});