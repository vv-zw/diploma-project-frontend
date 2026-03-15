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
    let alreadyData = wx.getStorageSync('alreadyList') || [];
    alreadyData = alreadyData.map((item) => {
      let genres = item.genres || item.selectedElements || [];
      if (typeof genres === 'string') {
        genres = genres.split(',').map((genre) => genre.trim()).filter(Boolean);
      } else if (!Array.isArray(genres)) {
        genres = [];
      }

      return {
        ...item,
        genres,
        selectedElements: genres,
        title: item.title || item.name,
        cover_url: item.cover_url || item.coverUrl || '/images/default_series.png',
        coverUrl: item.cover_url || item.coverUrl || '/images/default_series.png'
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
    const formattedList = this.formatSeriesData(recommendList);
    const gridList = this.formatToGrid(formattedList);
    this.setData({
      gridList,
      countWeights: countWeights || {},
      recommendReasons: this.formatRecommendReasons(recommendReasons, countWeights),
      loading: false,
      error: formattedList.length === 0 ? '暂无推荐数据，请先添加一些追剧偏好' : ''
    });
  },

  fetchRecommendations() {
    this.setData({ loading: true, error: '' });

    wx.request({
      url: `${this.getBackendUrl()}/get_recommend`,
      data: { type: 'series' },
      timeout: 10000,
      success: (res) => {
        if (res.data && res.data.code === 0) {
          this.processRecommendData(
            res.data.data,
            res.data.count_weights,
            res.data.recommend_reasons_summary
          );
        } else {
          this.setData({
            loading: false,
            error: (res.data && res.data.error) || '获取推荐失败'
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

  formatSeriesData(list) {
    if (!Array.isArray(list)) return [];
    const batchId = Date.now();

    return list.map((series, index) => {
      if (!series) return null;

      let genres = series.genres || [];
      if (typeof genres === 'string') {
        genres = genres.split(',').map((genre) => genre.trim()).filter(Boolean);
      } else if (!Array.isArray(genres)) {
        genres = [];
      }

      let rating = series.rating || '暂无';
      if (typeof rating === 'number') {
        rating = rating.toFixed(1);
      }

      const matchScore = this.formatMatchScore(series.recommend_match_score, series.final_score);
      const rawCoverUrl = series.cover_url || series.coverUrl || '';
      const coverUrl = rawCoverUrl
        ? `${this.getBackendUrl()}/proxy-image?url=${encodeURIComponent(rawCoverUrl)}`
        : '/images/default_series.png';
      const uniqueId = series.id || series.seriesId || `series_${batchId}_${index}_${Math.random().toString(36).slice(2, 7)}`;

      return {
        id: uniqueId,
        title: series.title || series.name || '未知剧集',
        rating,
        cover_url: coverUrl,
        coverUrl,
        genres,
        genresText: genres.length ? genres.join(' / ') : '暂无类型信息',
        recommendMatchScore: matchScore,
        year: series.year || '',
        director: series.director || '',
        actors: series.actors || '',
        type: 'series',
        content_type: 'series',
        ...series
      };
    }).filter(Boolean);
  },

  formatMatchScore(recommendMatchScore, finalScore) {
    let score = recommendMatchScore;
    if (typeof score !== 'number') {
      score = Number(score);
    }

    if (!Number.isFinite(score)) {
      let fallback = finalScore;
      if (typeof fallback !== 'number') {
        fallback = Number(fallback);
      }
      if (Number.isFinite(fallback)) {
        score = Math.round(fallback * 100);
      }
    }

    if (!Number.isFinite(score)) {
      return '暂无';
    }

    const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
    return `${normalizedScore}%`;
  },

  formatRecommendReasons(recommendReasons, countWeights) {
    if (Array.isArray(recommendReasons) && recommendReasons.length > 0) {
      return recommendReasons.filter((item) => typeof item === 'string' && item.trim()).slice(0, 5);
    }

    const fallbackReasons = [];
    const weights = countWeights || {};
    const genres = weights.genres ? Object.keys(weights.genres).slice(0, 3) : [];
    const directors = weights.directors ? Object.keys(weights.directors).slice(0, 2) : [];
    const actors = weights.actors ? Object.keys(weights.actors).slice(0, 2) : [];

    if (genres.length) {
      fallbackReasons.push(`偏好${genres.join('、')}题材`);
    }
    if (directors.length) {
      fallbackReasons.push(`更常选择${directors.join('、')}相关作品`);
    }
    if (actors.length) {
      fallbackReasons.push(`关注演员${actors.join('、')}参演内容`);
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
      syncStatus: '正在刷新推荐，请稍候...',
      loading: true,
      isRefreshing: true,
      error: ''
    });

    wx.request({
      url: `${this.getBackendUrl()}/refresh-recommendations`,
      method: 'POST',
      data: { type: 'series' },
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
        } else if (res.data && res.data.code === 0 && res.data.job_id) {
          this.setData({ refreshJobId: res.data.job_id });
          this.pollRefreshStatus(res.data.job_id);
        } else {
          this.setData({
            syncStatus: '刷新失败',
            loading: false,
            isRefreshing: false,
            error: (res.data && res.data.error) || '刷新失败'
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
    }, 2000);
  },

  stopRefreshPolling() {
    if (this.refreshPollingTimer) {
      clearInterval(this.refreshPollingTimer);
      this.refreshPollingTimer = null;
    }
  },

  onImageError(e) {
    const seriesId = e.currentTarget.dataset.id;
    const newGridList = this.data.gridList.map((row) =>
      row.map((series) =>
        series.id === seriesId ? { ...series, cover_url: '/images/default_series.png', coverUrl: '/images/default_series.png' } : series
      )
    );
    this.setData({ gridList: newGridList });

    const newSearchResults = this.data.searchResults.map((series) =>
      series.id === seriesId ? { ...series, cover_url: '/images/default_series.png', coverUrl: '/images/default_series.png' } : series
    );
    this.setData({ searchResults: newSearchResults });

    const newAlreadyList = this.data.alreadyList.map((series) =>
      series.id === seriesId ? { ...series, cover_url: '/images/default_series.png', coverUrl: '/images/default_series.png' } : series
    );
    this.setData({ alreadyList: newAlreadyList });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/show/show?id=${id}` });
  },

  getSeriesById(id) {
    for (const row of this.data.gridList) {
      const series = row.find((item) => item.id === id);
      if (series) return series;
    }
    const searchSeries = this.data.searchResults.find((item) => item.id === id);
    if (searchSeries) return searchSeries;
    return this.data.alreadyList.find((item) => item.id === id) || null;
  },

  handleNegativeFeedback(e) {
    const seriesId = e.currentTarget.dataset.id;
    const series = this.getSeriesById(seriesId);
    if (!series) return;

    wx.showModal({
      title: '不感兴趣',
      content: `确定对《${series.title}》不感兴趣吗？将不再为你推荐类似剧集`,
      success: (res) => {
        if (res.confirm) {
          this.submitNegativeFeedback(seriesId);
          this.removeSeriesFromUI(seriesId);
          wx.showToast({ title: '已记录你的偏好', icon: 'success' });
        }
      }
    });
  },

  submitNegativeFeedback(seriesId) {
    wx.request({
      url: `${this.getBackendUrl()}/negative-feedback`,
      method: 'POST',
      data: {
        item_id: seriesId,
        type: 'series',
        reason: '用户标记不感兴趣'
      }
    });
  },

  removeSeriesFromUI(seriesId) {
    const newGridList = this.data.gridList
      .map((row) => row.filter((series) => series.id !== seriesId))
      .filter((row) => row.length > 0);
    this.setData({ gridList: newGridList });
    this.setData({ searchResults: this.data.searchResults.filter((series) => series.id !== seriesId) });
    const newAlreadyList = this.data.alreadyList.filter((series) => series.id !== seriesId);
    this.setData({ alreadyList: newAlreadyList });
    wx.setStorageSync('alreadyList', newAlreadyList);
  },

  addToWatchlist(e) {
    const seriesId = e.currentTarget.dataset.id;
    const series = this.getSeriesById(seriesId);
    if (!series) {
      wx.showToast({ title: '剧集信息不存在', icon: 'none' });
      return;
    }

    let alreadyList = wx.getStorageSync('alreadyList') || [];
    if (alreadyList.some((item) => item.id === seriesId)) {
      wx.showToast({ title: '已在想看清单中', icon: 'none' });
      return;
    }

    const newSeries = {
      id: series.id,
      name: series.title || series.name,
      title: series.title || series.name,
      rating: series.rating,
      coverUrl: series.cover_url || series.coverUrl,
      cover_url: series.cover_url || series.coverUrl,
      year: series.year || '',
      genres: series.genres || series.selectedElements || [],
      selectedElements: series.genres || series.selectedElements || [],
      director: series.director || '',
      type: 'series',
      content_type: 'series',
      addedTime: Date.now()
    };

    alreadyList.push(newSeries);
    wx.setStorageSync('alreadyList', alreadyList);
    const totalList = wx.getStorageSync('totalSeriesList') || [];
    totalList.push(newSeries);
    wx.setStorageSync('totalSeriesList', totalList);
    this.loadAlreadyData();
    wx.showToast({ title: '已添加到想看清单', icon: 'success' });
    this.syncPreferencesAfterWatchlistUpdate('series');
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
        if (res.confirm) {
          let alreadyList = wx.getStorageSync('alreadyList') || [];
          const newAlreadyList = alreadyList.filter((item) => item.id !== id);
          wx.setStorageSync('alreadyList', newAlreadyList);
          const totalList = wx.getStorageSync('totalSeriesList') || [];
          wx.setStorageSync('totalSeriesList', totalList.filter((item) => item.id !== id));
          this.loadAlreadyData();
          wx.showToast({ title: '已从想看清单移除', icon: 'none' });
        }
      }
    });
  },

  searchSeries(e) {
    const query = e.detail?.value || this.data.searchQuery;
    if (!query.trim()) {
      this.setData({ searchResults: [], showSearch: false });
      return;
    }

    this.setData({ searchQuery: query, loading: true });
    wx.request({
      url: `${this.getBackendUrl()}/search`,
      data: { q: query, type: 'series' },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({
            searchResults: this.formatSeriesData(res.data.results),
            showSearch: true,
            loading: false
          });
        } else {
          this.setData({
            loading: false,
            error: res.data.error || '搜索失败'
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

  goToAddSeries() {
    wx.navigateTo({ url: '/pages/add/add' });
  },

  goToAlreadyPage() {
    wx.navigateTo({ url: '/pages/already/already' });
  }
});
