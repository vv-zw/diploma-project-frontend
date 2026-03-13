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
      this.fetchRecommendations();
    }
    this.loadAlreadyData();
  },

  onUnload() {
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
    const formattedList = this.formatSeriesData(recommendList);
    const gridList = this.formatToGrid(formattedList);
    this.setData({
      gridList,
      countWeights: countWeights || {},
      loading: false,
      error: formattedList.length === 0 ? '暂无推荐数据，请添加剧集偏好' : ''
    });
  },

  fetchRecommendations() {
    this.setData({ loading: true, error: '' });
    wx.request({
      url: 'http://localhost:5000/get_recommend',
      data: { type: 'series' },
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

  formatSeriesData(list) {
    if (!Array.isArray(list)) return [];
    return list.map((series) => {
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

      return {
        id: series.id || '',
        title: series.title || series.name || '未知剧集',
        name: series.title || series.name || '未知剧集',
        rating,
        cover_url: series.cover_url
          ? `http://localhost:5000/proxy-image?url=${encodeURIComponent(series.cover_url)}`
          : '/images/default_series.png',
        coverUrl: series.cover_url
          ? `http://localhost:5000/proxy-image?url=${encodeURIComponent(series.cover_url)}`
          : '/images/default_series.png',
        similarity: series.similarity ? series.similarity.toFixed(1) : '0',
        genres,
        selectedElements: genres,
        year: series.year || '',
        director: series.director || '',
        type: 'series'
      };
    });
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
      data: { type: 'series' },
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
    const seriesId = e.currentTarget.dataset.id;
    const newGridList = this.data.gridList.map((row) =>
      row.map((series) =>
        series.id === seriesId ? { ...series, cover_url: '/images/default_series.png', coverUrl: '/images/default_series.png' } : series
      )
    );
    this.setData({ gridList: newGridList });
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/show/show?id=${id}` });
  },

  getSeriesById(id) {
    for (const row of this.data.gridList) {
      const series = row.find((m) => m.id === id);
      if (series) return series;
    }
    const searchHit = this.data.searchResults.find((m) => m.id === id);
    if (searchHit) return searchHit;
    return this.data.alreadyList.find((m) => m.id === id) || null;
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
      url: 'http://localhost:5000/negative-feedback',
      method: 'POST',
      data: {
        item_id: seriesId,
        type: 'series',
        reason: '用户标记不感兴趣'
      }
    });
  },

  removeSeriesFromUI(seriesId) {
    const newGridList = this.data.gridList.map((row) => row.filter((series) => series.id !== seriesId)).filter((row) => row.length > 0);
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
      wx.showToast({ title: '已在待看清单中', icon: 'none' });
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
      selectedElements: series.genres || series.selectedElements || [],
      director: series.director || '',
      type: 'series',
      addedTime: Date.now()
    };

    alreadyList.push(newSeries);
    wx.setStorageSync('alreadyList', alreadyList);
    const totalList = wx.getStorageSync('totalSeriesList') || [];
    totalList.push(newSeries);
    wx.setStorageSync('totalSeriesList', totalList);
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
          const totalList = wx.getStorageSync('totalSeriesList') || [];
          wx.setStorageSync('totalSeriesList', totalList.filter((item) => item.id !== id));
          this.loadAlreadyData();
          wx.showToast({ title: '已从待看清单移除', icon: 'none' });
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
      url: 'http://localhost:5000/search',
      data: { q: query, type: 'series' },
      success: (res) => {
        if (res.data.code === 0) {
          this.setData({
            searchResults: this.formatSeriesData(res.data.results),
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

  goToAddSeries() {
    wx.navigateTo({ url: '/pages/addSeries/addSeries' });
  },

  goToAlreadyPage() {
    wx.navigateTo({ url: '/pages/already/already' });
  }
});
