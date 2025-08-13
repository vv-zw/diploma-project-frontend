// pages/movieRecommend/movieRecommend.js
Page({
  data: {
    gridList: [],         // 用于渲染的二维数组（每行3个电影）
    loading: false,
    error: '',
    countWeights: {},     // 用户标签权重（用于展示推荐依据）
    syncStatus: ''        // 同步状态提示
  },

  onLoad() {
    // 接收从电影页传递的推荐数据（避免重复请求）
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('sendRecommendData', (data) => {
        console.log('从电影页接收推荐数据');
        this.processRecommendData(data.recommendList, data.countWeights);
      });
    } else {
      // 直接进入页面时主动请求
      this.fetchRecommendations();
    }
  },

  onShow() {
    // 页面显示时检查是否有新的推荐数据
    if (this.data.gridList.length === 0) {
      this.fetchRecommendations();
    }
  },

  // 处理推荐数据并更新UI
  processRecommendData(recommendList, countWeights) {
    const formattedList = this.formatMovieData(recommendList);
    const gridList = this.formatToGrid(formattedList);
    this.setData({
      gridList,
      countWeights: countWeights || {},
      loading: false,
      error: ''
    });
  },

  // 获取推荐电影（与后端同步接口联动）
  fetchRecommendations() {
    this.setData({ loading: true, error: '' });
    
    wx.request({
      url: `https://blue-groups-tan.loca.lt/get_recommend`,
      data: { type: 'movie' },
      timeout: 10000,  // 延长超时时间
      success: (res) => {
        console.log('获取推荐数据成功:', res.data);
        
        if (res.data.code === 0) {
          this.processRecommendData(res.data.data, res.data.count_weights);
        } else {
          this.setData({
            loading: false,
            error: res.data.error || '获取推荐失败'
          });
        }
      },
      fail: (err) => {
        console.error('获取推荐数据失败:', err);
        this.setData({
          loading: false,
          error: '网络错误，无法获取推荐（请检查后端服务）'
        });
      }
    });
  },

  // 格式化电影数据（适配后端返回格式）
  formatMovieData(list) {
    return list.map(movie => {
      // 处理类型字段（与movie.js保持一致的格式）
      let genres = movie.genres || [];
      if (typeof genres === 'string') {
        genres = genres.split(',').map(genre => genre.trim()).filter(Boolean);
      } else if (!Array.isArray(genres)) {
        genres = [];
      }

      // 处理评分显示（保留一位小数）
      let rating = movie.rating || '暂无';
      if (typeof rating === 'number') {
        rating = rating.toFixed(1);
      }

      return {
        id: movie.id || '',
        title: movie.title || '未知标题',
        rating: rating,
        // 使用图片代理接口处理跨域问题
        cover_url: movie.cover_url 
          ? `https://blue-groups-tan.loca.lt/proxy-image?url=${encodeURIComponent(movie.cover_url)}`
          : '/images/default_movie.png',
        similarity: movie.similarity ? movie.similarity.toFixed(1) : '0',
        genres: genres
      };
    });
  },

  // 转换为二维数组（每行3个电影）
  formatToGrid(list) {
    const grid = [];
    for (let i = 0; i < list.length; i += 3) {
      grid.push(list.slice(i, i + 3));
    }
    return grid;
  },

  // 刷新推荐（强制重新获取）
  refreshRecommendations() {
    this.setData({ syncStatus: '正在刷新推荐...' });
    this.fetchRecommendations();
    // 3秒后清除状态提示（防止一直显示）
    setTimeout(() => {
      if (this.data.syncStatus === '正在刷新推荐...') {
        this.setData({ syncStatus: '' });
      }
    }, 3000);
  },

  // 图片加载失败时使用默认图
  onImageError(e) {
    const movieId = e.currentTarget.dataset.id;
    const newGridList = this.data.gridList.map(row => 
      row.map(movie => 
        movie.id === movieId ? { ...movie, cover_url: '/images/default_movie.png' } : movie
      )
    );
    this.setData({ gridList: newGridList });
  },

  // 跳转到电影详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/movie/movie?id=${id}` });
  },

  // 跳转到添加电影页
  goToAddMovie() {
    wx.navigateTo({ 
      url: '/pages/add/add',
      // 添加完成后刷新推荐
      events: {
        onMovieAdded: () => {
          this.setData({ syncStatus: '添加成功，正在更新推荐...' });
          this.fetchRecommendations();
        }
      }
    });
  }
});
