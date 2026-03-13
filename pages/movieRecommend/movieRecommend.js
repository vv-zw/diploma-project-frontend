Page({
  data: {
    gridList: [],
    loading: false,
    error: '',
    countWeights: {},
    syncStatus: '',
    searchQuery: '',
    searchResults: [],
    showSearch: false,
    activeTab: 'recommend',
    alreadyList: [],
    refreshJobId: '',
    isRefreshing: false
  },

  onLoad() {
    const eventChannel = this.getOpenerEventChannel();
    if (eventChannel) {
      eventChannel.on('sendRecommendData', (data) => {
        this.processRecommendData(data.recommendList || data.data, data.countWeights);
      });
    } else {
      this.fetchRecommendations();
    }
    this.loadAlreadyData();
  },

  onShow() {
    if (this.data.activeTab === 'recommend' && !this.data.isRefreshing) {
      if (!this.refreshTimer) {
        this.refreshTimer = setTimeout(() => {
          this.fetchRecommendations();
          this.refreshTimer = null;
        }, 300);
      }
    }
    this.loadAlreadyData();
  },

  onUnload() {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.stopRefreshPolling();
  },

  loadAlreadyData() {
    let alreadyData = wx.getStorageSync('alreadyList') || [];
    alreadyData = alreadyData.map((item) => {
      let elements = item.selectedElements || [];
      if (typeof elements === 'string') {
        elements = elements.split(',');
      }
      return {
        ...item,
        selectedElements: elements,
        title: item.title || item.name,
        cover_url: item.cover_url || item.coverUrl
      };
    });
    this.setData({ alreadyList: alreadyData });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      activeTab: tab,
      showSearch: tab === 'search'
    });
  },

  processRecommendData(recommendList, countWeights) {
    const formattedList = this.formatMovieData(recommendList);
    const gridList = this.formatToGrid(formattedList);
    this.setData({
      gridList,
      countWeights: countWeights || {},
      loading: false,
      error: formattedList.length === 0 ? '暂无推荐数据，请添加观影偏好' : ''
    });
  },

  fetchRecommendations() {
    this.setData({ loading: true, error: '' });

    wx.request({
      url: 'http://localhost:5000/get_recommend',
      data: { type: 'movie' },
      timeout: 10000,
      success: (res) => {
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

  formatMovieData(list) {
    if (!Array.isArray(list)) return [];
    const batchId = Date.now();

    return list.map((movie, index) => {
      if (!movie) return null;

      let genres = movie.genres || [];
      if (typeof genres === 'string') {
        genres = genres.split(',').map((genre) => genre.trim()).filter(Boolean);
      } else if (!Array.isArray(genres)) {
        genres = [];
      }

      let rating = movie.rating || '暂无';
      if (typeof rating === 'number') {
        rating = rating.toFixed(1);
      }

      const coverUrl = movie.cover_url || '';
      const uniqueId = movie.id || movie.movieId || `movie_${batchId}_${index}_${Math.random().toString(36).slice(2, 7)}`;

      return {
        id: uniqueId,
        title: movie.title || '未知影片',
        rating,
        cover_url: coverUrl || '/images/default_movie.png',
        coverUrl: coverUrl || '/images/default_movie.png',
        genres,
        year: movie.year || '',
        director: movie.director || '',
        actors: movie.actors || '',
        ...movie
      };
    }).filter(Boolean);
  },

  formatToGrid(list) {
    const grid = [];
    for (let i = 0; i < list.length; i += 3) {
      grid.push(list.slice(i, i + 3));
    }
    return grid;
  },

  refreshRecommendations() {
    this.stopRefreshPolling();
    this.setData({
      syncStatus: '正在刷新推荐，请稍候...',
      loading: true,
      isRefreshing: true,
      error: ''
    });

    wx.request({
      url: 'http://localhost:5000/refresh-recommendations',
      method: 'POST',
      data: { type: 'movie' },
      timeout: 10000,
      success: (res) => {
        if (res.data.code === 0 && res.data.job_id) {
          this.setData({ refreshJobId: res.data.job_id });
          this.pollRefreshStatus(res.data.job_id);
        } else {
          this.setData({
            syncStatus: '刷新失败',
            loading: false,
            isRefreshing: false,
            error: res.data.error || '刷新失败'
          });
        }
      },
      fail: () => {
        this.setData({
          syncStatus: '刷新失败',
          loading: false,
          isRefreshing: false,
          error: '网络错误，刷新失败'
        });
      }
    });
  },

  pollRefreshStatus(jobId) {
    this.stopRefreshPolling();
    this.refreshPollingTimer = setInterval(() => {
      wx.request({
        url: 'http://localhost:5000/refresh-status',
        data: { job_id: jobId },
        timeout: 10000,
        success: (res) => {
          if (res.data.code !== 0) {
            return;
          }

          if (res.data.status === 'done') {
            this.stopRefreshPolling();
            this.setData({
              refreshJobId: '',
              isRefreshing: false,
              syncStatus: '推荐已更新'
            });
            this.fetchRecommendations();
            setTimeout(() => this.setData({ syncStatus: '' }), 3000);
          } else if (res.data.status === 'failed') {
            this.stopRefreshPolling();
            this.setData({
              refreshJobId: '',
              isRefreshing: false,
              loading: false,
              syncStatus: '刷新失败',
              error: res.data.error || '刷新失败'
            });
          }
        },
        fail: () => {
          this.stopRefreshPolling();
          this.setData({
            refreshJobId: '',
            isRefreshing: false,
            loading: false,
            syncStatus: '刷新失败',
            error: '网络错误，无法查询刷新状态'
          });
        }
      });
    }, 2000);
  },

  stopRefreshPolling() {
    if (this.refreshPollingTimer) {
      clearInterval(this.refreshPollingTimer);
      this.refreshPollingTimer = null;
    }
  },

  onImageError(e) {
    const movieId = e.currentTarget.dataset.id;
    const newGridList = this.data.gridList.map((row) =>
      row.map((movie) =>
        movie.id === movieId ? { ...movie, cover_url: '/images/default_movie.png', coverUrl: '/images/default_movie.png' } : movie
      )
    );
    this.setData({ gridList: newGridList });

    const newSearchResults = this.data.searchResults.map((movie) =>
      movie.id === movieId ? { ...movie, cover_url: '/images/default_movie.png', coverUrl: '/images/default_movie.png' } : movie
    );
    this.setData({ searchResults: newSearchResults });

    const newAlreadyList = this.data.alreadyList.map((movie) =>
      movie.id === movieId ? { ...movie, cover_url: '/images/default_movie.png', coverUrl: '/images/default_movie.png' } : movie
    );
    this.setData({ alreadyList: newAlreadyList });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/movie/movie?id=${id}` });
  },

  getMovieById(id) {
    for (const row of this.data.gridList) {
      const movie = row.find((m) => m.id === id);
      if (movie) return movie;
    }
    const movie = this.data.searchResults.find((m) => m.id === id);
    if (movie) return movie;
    return this.data.alreadyList.find((m) => m.id === id) || null;
  },

  handleNegativeFeedback(e) {
    const movieId = e.currentTarget.dataset.id;
    const movie = this.getMovieById(movieId);
    if (!movie) return;

    wx.showModal({
      title: '不感兴趣',
      content: `确定对《${movie.title}》不感兴趣吗？将不再为你推荐类似影片`,
      success: (res) => {
        if (res.confirm) {
          this.submitNegativeFeedback(movieId);
          this.removeMovieFromUI(movieId);
          wx.showToast({ title: '已记录你的偏好', icon: 'success' });
        }
      }
    });
  },

  submitNegativeFeedback(movieId) {
    wx.request({
      url: 'http://localhost:5000/negative-feedback',
      method: 'POST',
      data: {
        item_id: movieId,
        type: 'movie',
        reason: '用户标记不感兴趣'
      }
    });
  },

  removeMovieFromUI(movieId) {
    const newGridList = this.data.gridList.map((row) => row.filter((movie) => movie.id !== movieId)).filter((row) => row.length > 0);
    this.setData({ gridList: newGridList });
    this.setData({ searchResults: this.data.searchResults.filter((movie) => movie.id !== movieId) });
    const newAlreadyList = this.data.alreadyList.filter((movie) => movie.id !== movieId);
    this.setData({ alreadyList: newAlreadyList });
    wx.setStorageSync('alreadyList', newAlreadyList);
  },

  addToWatchlist(e) {
    const movieId = e.currentTarget.dataset.id;
    const movie = this.getMovieById(movieId);
    if (!movie) {
      wx.showToast({ title: '影片信息不存在', icon: 'none' });
      return;
    }

    let alreadyList = wx.getStorageSync('alreadyList') || [];
    if (alreadyList.some((item) => item.id === movieId)) {
      wx.showToast({ title: '已在待看清单中', icon: 'none' });
      return;
    }

    const newMovie = {
      id: movie.id,
      name: movie.title || movie.name,
      title: movie.title || movie.name,
      rating: movie.rating,
      coverUrl: movie.cover_url || movie.coverUrl,
      cover_url: movie.cover_url || movie.coverUrl,
      year: movie.year || '',
      selectedElements: movie.genres || movie.selectedElements || [],
      director: movie.director || '',
      addedTime: Date.now()
    };

    alreadyList.push(newMovie);
    wx.setStorageSync('alreadyList', alreadyList);
    const totalList = wx.getStorageSync('totalMovieList') || [];
    totalList.push(newMovie);
    wx.setStorageSync('totalMovieList', totalList);
    this.loadAlreadyData();
    wx.showToast({ title: '已添加到待看清单', icon: 'success' });
  },

  deleteAlready(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要从待看清单中删除吗？',
      success: (res) => {
        if (res.confirm) {
          let alreadyList = wx.getStorageSync('alreadyList') || [];
          const newAlreadyList = alreadyList.filter((item) => item.id !== id);
          wx.setStorageSync('alreadyList', newAlreadyList);
          const totalList = wx.getStorageSync('totalMovieList') || [];
          wx.setStorageSync('totalMovieList', totalList.filter((item) => item.id !== id));
          this.loadAlreadyData();
          wx.showToast({ title: '已从待看清单移除', icon: 'none' });
        }
      }
    });
  },

  searchMovies(e) {
    const query = e.detail?.value || this.data.searchQuery;
    if (!query.trim()) {
      this.setData({ searchResults: [], showSearch: false });
      return;
    }

    this.setData({ searchQuery: query, loading: true });
    wx.request({
      url: 'http://localhost:5000/search',
      data: { q: query, type: 'movie' },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({
            searchResults: this.formatMovieData(res.data.results),
            showSearch: true,
            loading: false
          });
        }
      },
      fail: () => {
        this.setData({ loading: false, error: '搜索失败' });
      }
    });
  },

  onSearchInput(e) {
    this.setData({ searchQuery: e.detail.value });
  },

  clearSearch() {
    this.setData({ searchQuery: '', searchResults: [], showSearch: false });
  },

  goToAddMovie() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  goToAlreadyPage() {
    wx.navigateTo({ url: '/pages/already/already' });
  }
});
