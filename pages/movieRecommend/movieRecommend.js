Page({
  data: {
    gridList: [],
    loading: false,
    error: '',
    countWeights: {},
    recommendReasons: [],
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
        this.processRecommendData(
          data.recommendList || data.data,
          data.countWeights || data.count_weights,
          data.recommendReasons || data.recommend_reasons_summary
        );
      });
    } else {
      this.fetchRecommendations();
    }

    this.loadAlreadyData();
  },

  onShow() {
    this.loadAlreadyData();
    if (this.data.activeTab === 'recommend' && !this.data.isRefreshing) {
      this.fetchRecommendations();
    }
  },

  onUnload() {
    this.stopRefreshPolling();
  },

  getBackendUrl() {
    const app = getApp();
    return (app && typeof app.getBackendUrl === 'function')
      ? app.getBackendUrl()
      : 'http://localhost:5000';
  },

  normalizeGenres(item) {
    const rawGenres = item?.genres ?? item?.selectedElements ?? [];

    if (Array.isArray(rawGenres)) {
      return rawGenres.map((genre) => String(genre).trim()).filter(Boolean);
    }

    if (typeof rawGenres === 'string') {
      return rawGenres
        .split(/[,/|、，]/)
        .map((genre) => genre.trim())
        .filter(Boolean);
    }

    return [];
  },

  loadAlreadyData() {
    const alreadyData = (wx.getStorageSync('alreadyList') || []).map((item) => {
      const genres = this.normalizeGenres(item);
      return {
        ...item,
        genres,
        selectedElements: genres,
        title: item.title || item.name || '未知影片',
        cover_url: item.cover_url || item.coverUrl || '/images/default_movie.png',
        coverUrl: item.cover_url || item.coverUrl || '/images/default_movie.png'
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

  processRecommendData(recommendList, countWeights, recommendReasons) {
    const formattedList = this.formatMovieData(recommendList);
    this.setData({
      gridList: this.formatToGrid(formattedList),
      countWeights: countWeights || {},
      recommendReasons: this.formatRecommendReasons(recommendReasons, countWeights),
      loading: false,
      error: formattedList.length ? '' : '暂无推荐数据，请先补充一些观影偏好'
    });
  },

  fetchRecommendations() {
    this.setData({ loading: true, error: '' });

    wx.request({
      url: `${this.getBackendUrl()}/get_recommend`,
      data: { type: 'movie' },
      timeout: 10000,
      success: (res) => {
        if (res.data && res.data.code === 0) {
          this.processRecommendData(
            res.data.data,
            res.data.count_weights,
            res.data.recommend_reasons_summary
          );
          return;
        }

        this.setData({
          loading: false,
          error: (res.data && res.data.error) || '获取推荐失败'
        });
      },
      fail: (err) => {
        console.error('获取推荐数据失败:', err);
        this.setData({
          loading: false,
          error: '网络错误，暂时无法获取推荐'
        });
      }
    });
  },

  formatMovieData(list) {
    if (!Array.isArray(list)) {
      return [];
    }

    return list.map((movie, index) => {
      if (!movie) {
        return null;
      }

      const genres = this.normalizeGenres(movie);
      let rating = movie.rating;
      if (typeof rating === 'number') {
        rating = rating.toFixed(1);
      }

      const coverUrl = movie.cover_url || movie.coverUrl || '/images/default_movie.png';
      return {
        ...movie,
        id: movie.id || movie.movieId || `movie_${Date.now()}_${index}`,
        title: movie.title || movie.name || '未知影片',
        rating: rating || '暂无',
        cover_url: coverUrl,
        coverUrl,
        genres,
        selectedElements: genres,
        genresText: genres.length ? genres.join(' / ') : '暂无类型信息',
        recommendMatchScore: this.formatMatchScore(movie.recommend_match_score, movie.final_score)
      };
    }).filter(Boolean);
  },

  formatMatchScore(recommendMatchScore, finalScore) {
    let score = Number(recommendMatchScore);
    if (!Number.isFinite(score)) {
      score = Math.round(Number(finalScore || 0) * 100);
    }

    if (!Number.isFinite(score)) {
      return '暂无';
    }

    return `${Math.max(0, Math.min(100, Math.round(score)))}%`;
  },

  formatRecommendReasons(recommendReasons, countWeights) {
    if (Array.isArray(recommendReasons) && recommendReasons.length) {
      return recommendReasons
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 5);
    }

    const fallbackReasons = [];
    const weights = countWeights || {};
    const genres = weights.genres ? Object.keys(weights.genres).slice(0, 3) : [];
    const directors = weights.directors ? Object.keys(weights.directors).slice(0, 2) : [];
    const actors = weights.actors ? Object.keys(weights.actors).slice(0, 2) : [];

    if (genres.length) {
      fallbackReasons.push(`偏好 ${genres.join(' / ')} 类型内容`);
    }
    if (directors.length) {
      fallbackReasons.push(`近期更关注 ${directors.join(' / ')} 的作品`);
    }
    if (actors.length) {
      fallbackReasons.push(`喜欢 ${actors.join(' / ')} 参演的影片`);
    }

    return fallbackReasons.slice(0, 5);
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
      syncStatus: '正在刷新推荐...',
      loading: true,
      isRefreshing: true,
      error: ''
    });

    wx.request({
      url: `${this.getBackendUrl()}/refresh-recommendations`,
      method: 'POST',
      data: { type: 'movie' },
      timeout: 10000,
      success: (res) => {
        if (res.data && res.data.code === 0 && res.data.status === 'done') {
          this.setData({
            refreshJobId: '',
            isRefreshing: false,
            syncStatus: res.data.rotated ? '已换一批推荐' : (res.data.reused ? '推荐已是最新' : '推荐已更新')
          });
          this.fetchRecommendations();
          setTimeout(() => this.setData({ syncStatus: '' }), 3000);
          return;
        }

        if (res.data && res.data.code === 0 && res.data.job_id) {
          this.setData({ refreshJobId: res.data.job_id });
          this.pollRefreshStatus(res.data.job_id);
          return;
        }

        this.setData({
          syncStatus: '刷新失败',
          loading: false,
          isRefreshing: false,
          error: (res.data && res.data.error) || '刷新失败'
        });
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
        url: `${this.getBackendUrl()}/refresh-status`,
        data: { job_id: jobId },
        timeout: 10000,
        success: (res) => {
          if (!res.data || res.data.code !== 0) {
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
    }, 1500);
  },

  stopRefreshPolling() {
    if (this.refreshPollingTimer) {
      clearInterval(this.refreshPollingTimer);
      this.refreshPollingTimer = null;
    }
  },

  onImageError(e) {
    const movieId = e.currentTarget.dataset.id;

    const updatePoster = (list) => list.map((item) => (
      item.id === movieId
        ? { ...item, cover_url: '/images/default_movie.png', coverUrl: '/images/default_movie.png' }
        : item
    ));

    this.setData({
      gridList: this.data.gridList.map((row) => updatePoster(row)),
      searchResults: updatePoster(this.data.searchResults),
      alreadyList: updatePoster(this.data.alreadyList)
    });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/movie/movie?id=${id}` });
  },

  getMovieById(id) {
    for (const row of this.data.gridList) {
      const movie = row.find((item) => item.id === id);
      if (movie) {
        return movie;
      }
    }

    return this.data.searchResults.find((item) => item.id === id)
      || this.data.alreadyList.find((item) => item.id === id)
      || null;
  },

  handleNegativeFeedback(e) {
    const movieId = e.currentTarget.dataset.id;
    const movie = this.getMovieById(movieId);
    if (!movie) {
      return;
    }

    wx.showModal({
      title: '不感兴趣',
      content: `确定不喜欢《${movie.title}》吗？后续会减少同类推荐。`,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        this.submitNegativeFeedback(movieId);
        this.removeMovieFromUI(movieId);
        wx.showToast({ title: '已记录你的偏好', icon: 'success' });
      }
    });
  },

  submitNegativeFeedback(movieId) {
    wx.request({
      url: `${this.getBackendUrl()}/negative-feedback`,
      method: 'POST',
      data: {
        item_id: movieId,
        type: 'movie',
        reason: '用户标记不感兴趣'
      }
    });
  },

  removeMovieFromUI(movieId) {
    const gridList = this.data.gridList
      .map((row) => row.filter((movie) => movie.id !== movieId))
      .filter((row) => row.length > 0);

    const searchResults = this.data.searchResults.filter((movie) => movie.id !== movieId);
    const alreadyList = this.data.alreadyList.filter((movie) => movie.id !== movieId);

    this.setData({ gridList, searchResults, alreadyList });
    wx.setStorageSync('alreadyList', alreadyList);
  },

  addToWatchlist(e) {
    const movieId = e.currentTarget.dataset.id;
    const movie = this.getMovieById(movieId);
    if (!movie) {
      wx.showToast({ title: '影片信息不存在', icon: 'none' });
      return;
    }

    const alreadyList = wx.getStorageSync('alreadyList') || [];
    if (alreadyList.some((item) => item.id === movieId)) {
      wx.showToast({ title: '已在想看清单中', icon: 'none' });
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
      genres: movie.genres || movie.selectedElements || [],
      selectedElements: movie.genres || movie.selectedElements || [],
      director: movie.director || '',
      type: 'movie',
      content_type: 'movie',
      addedTime: Date.now()
    };

    alreadyList.push(newMovie);
    wx.setStorageSync('alreadyList', alreadyList);

    const totalList = wx.getStorageSync('totalMovieList') || [];
    totalList.push(newMovie);
    wx.setStorageSync('totalMovieList', totalList);

    this.loadAlreadyData();
    wx.showToast({ title: '已加入想看清单', icon: 'success' });
    this.syncPreferencesAfterWatchlistUpdate('movie');
  },

  syncPreferencesAfterWatchlistUpdate(contentType) {
    const app = getApp();
    if (!app || typeof app.syncAndRefresh !== 'function') {
      return;
    }

    this.setData({
      syncStatus: '正在同步偏好并刷新推荐...',
      isRefreshing: true
    });

    app.syncAndRefresh(contentType, {
      onSuccess: (result) => {
        const refreshData = (result && result.refreshResult && result.refreshResult.data) || {};
        this.setData({
          isRefreshing: false,
          syncStatus: refreshData.rotated ? '已换一批推荐' : (refreshData.reused ? '推荐已是最新' : '推荐已更新')
        });
        this.fetchRecommendations();
        setTimeout(() => this.setData({ syncStatus: '' }), 3000);
      },
      onFail: () => {
        this.setData({
          isRefreshing: false,
          syncStatus: '本地已保存，推荐稍后更新'
        });
        setTimeout(() => this.setData({ syncStatus: '' }), 3000);
      }
    });
  },

  deleteAlready(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要从想看清单中删除吗？',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const alreadyList = (wx.getStorageSync('alreadyList') || []).filter((item) => item.id !== id);
        wx.setStorageSync('alreadyList', alreadyList);

        const totalList = (wx.getStorageSync('totalMovieList') || []).filter((item) => item.id !== id);
        wx.setStorageSync('totalMovieList', totalList);

        this.loadAlreadyData();
        wx.showToast({ title: '已从想看清单移除', icon: 'none' });
      }
    });
  },

  searchMovies(e) {
    const query = (e.detail && e.detail.value) || this.data.searchQuery;
    if (!String(query || '').trim()) {
      this.setData({ searchResults: [], showSearch: false });
      return;
    }

    this.setData({ searchQuery: query, loading: true });
    wx.request({
      url: `${this.getBackendUrl()}/search`,
      data: { q: query, type: 'movie' },
      success: (res) => {
        if (res.data && res.data.code === 0) {
          this.setData({
            searchResults: this.formatMovieData(res.data.results),
            showSearch: true,
            loading: false
          });
          return;
        }

        this.setData({
          loading: false,
          error: (res.data && res.data.error) || '搜索失败'
        });
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
