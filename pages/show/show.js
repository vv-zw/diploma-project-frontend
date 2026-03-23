Page({
  data: {
    currentShow: null,
    searchName: '',
    searchResult: null,
    searchHistory: [],
    loading: false,
    detailLoading: false,
    errorMsg: '',
    showList: [],
    selectedElements: [],
    rowCount: 0
  },

  getBackendUrl() {
    const app = getApp();
    return app && typeof app.getBackendUrl === 'function'
      ? app.getBackendUrl()
      : 'http://localhost:5000';
  },

  buildFallbackShow(name) {
    const title = String(name || '').trim() || 'Untitled Series';
    return {
      id: `custom_series_${Date.now()}`,
      name: title,
      title,
      coverUrl: '',
      cover_url: '',
      rating: 'N/A',
      genres: 'Unknown',
      year: '',
      director: '',
      actors: [],
      episodes: 'Unknown',
      region: 'Unknown',
      type: 'series',
      content_type: 'series',
      comment: 'No comment',
      selectedElements: ['Unknown']
    };
  },

  normalizeShowItem(item = {}) {
    return {
      id: item.id || `custom_series_${Date.now()}`,
      name: item.name || item.title || 'Untitled Series',
      title: item.title || item.name || 'Untitled Series',
      coverUrl: item.coverUrl || item.cover_url || item.image || '',
      cover_url: item.cover_url || item.coverUrl || item.image || '',
      rating: item.rating || item.rate || 'N/A',
      genres: item.genres || item.type || 'Unknown',
      year: item.year || item.release_date || '',
      director: item.director || '',
      actors: item.actors || [],
      episodes: item.episodes || 'Unknown',
      region: item.region || 'Unknown',
      type: item.type || 'series',
      content_type: item.content_type || 'series',
      comment: item.comment || 'No comment'
    };
  },

  updateRowCount() {
    this.setData({
      rowCount: Math.ceil((this.data.showList.length || 0) / 2)
    });
  },

  onSearchInput(e) {
    this.setData({ searchName: e.detail.value });
  },

  appendSearchHistory(name) {
    const title = String(name || '').trim();
    if (!title) {
      return;
    }

    const searchHistory = this.data.searchHistory.filter((item) => item !== title);
    searchHistory.unshift(title);
    if (searchHistory.length > 10) {
      searchHistory.length = 10;
    }

    this.setData({ searchHistory });
    wx.setStorageSync('showSearchHistory', searchHistory);
  },

  searchShow() {
    const searchName = String(this.data.searchName || '').trim();
    if (!searchName) {
      wx.showToast({ title: '请输入剧集名称', icon: 'none' });
      return;
    }

    this.setData({
      loading: true,
      errorMsg: '',
      searchResult: null
    });

    wx.request({
      url: `${this.getBackendUrl()}/api/get-drama-by-name`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { name: searchName },
      success: (res) => {
        this.setData({ loading: false });

        if (res.data && res.data.code === 0 && res.data.data) {
          const showData = this.normalizeShowItem(res.data.data);
          this.setData({
            searchResult: showData,
            currentShow: showData
          });
          this.appendSearchHistory(searchName);
          return;
        }

        const fallbackShow = this.buildFallbackShow(searchName);
        this.setData({
          searchResult: fallbackShow,
          currentShow: fallbackShow,
          errorMsg: 'Not found in database. Created with default info.'
        });
        this.appendSearchHistory(searchName);
        wx.showToast({ title: 'Created default item', icon: 'none' });
      },
      fail: () => {
        const fallbackShow = this.buildFallbackShow(searchName);
        this.setData({
          loading: false,
          searchResult: fallbackShow,
          currentShow: fallbackShow,
          errorMsg: 'Request failed. Created with default info.'
        });
        this.appendSearchHistory(searchName);
        wx.showToast({ title: 'Created default item', icon: 'none' });
      }
    });
  },

  loadFromLocalCache() {
    let showList = wx.getStorageSync('showList') || [];
    showList = showList
      .filter((item) => item && (item.id || item.title || item.name))
      .map((item) => this.normalizeShowItem(item));

    this.setData({
      showList,
      searchHistory: wx.getStorageSync('showSearchHistory') || []
    });
    this.updateRowCount();
  },

  batchQueryShowDetails(showNames) {
    if (!showNames || !showNames.length) {
      return;
    }

    this.setData({ detailLoading: true });
    wx.request({
      url: `${this.getBackendUrl()}/api/get-dramas-by-names`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        names: showNames,
        onlyReturnRequested: true
      },
      success: (res) => {
        this.setData({ detailLoading: false });
        if (!(res.data && res.data.code === 0 && Array.isArray(res.data.results))) {
          return;
        }

        const showList = res.data.results.map((entry) => {
          if (entry && entry.data) {
            return this.normalizeShowItem({
              ...entry.data,
              title: entry.data.title || entry.matched_title,
              name: entry.data.name || entry.matched_title
            });
          }
          return this.buildFallbackShow(entry?.name_requested || entry?.matched_title || '');
        });

        this.setData({ showList });
        wx.setStorageSync('showList', showList);
        this.updateRowCount();
      },
      fail: () => {
        this.setData({ detailLoading: false });
        wx.showToast({ title: 'Batch query failed', icon: 'none' });
      }
    });
  },

  selectFromHistory(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({ searchName: name }, () => this.searchShow());
  },

  clearHistory() {
    wx.showModal({
      title: 'Confirm',
      content: 'Clear all search history?',
      success: (res) => {
        if (!res.confirm) {
          return;
        }
        this.setData({ searchHistory: [] });
        wx.setStorageSync('showSearchHistory', []);
        wx.showToast({ title: 'Cleared', icon: 'none' });
      }
    });
  },

  batchSearchShows() {
    if (!this.data.searchHistory.length) {
      wx.showToast({ title: 'No history to query', icon: 'none' });
      return;
    }
    this.batchQueryShowDetails(this.data.searchHistory);
  },

  deleteShow(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: 'Confirm',
      content: 'Delete this series?',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const showList = this.data.showList.filter((item) => item.id !== id && item.name !== name);
        this.setData({ showList });
        wx.setStorageSync('showList', showList);
        this.updateRowCount();
        wx.showToast({ title: 'Deleted', icon: 'none' });
      }
    });
  },

  batchDelete() {
    const { selectedElements, showList } = this.data;
    if (!selectedElements.length) {
      wx.showToast({ title: 'Select series first', icon: 'none' });
      return;
    }

    wx.showModal({
      title: 'Confirm',
      content: `Delete ${selectedElements.length} selected series?`,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const newShowList = showList.filter((item) => (
          !selectedElements.includes(item.id) && !selectedElements.includes(item.name)
        ));
        this.setData({
          showList: newShowList,
          selectedElements: []
        });
        wx.setStorageSync('showList', newShowList);
        this.updateRowCount();
        wx.showToast({ title: 'Deleted', icon: 'none' });
      }
    });
  },

  checkboxChange(e) {
    this.setData({ selectedElements: e.detail.value });
  },

  handleCheckboxTap(e) {
    const value = e.currentTarget.dataset.value;
    const selectedElements = [...this.data.selectedElements];
    const index = selectedElements.indexOf(value);

    if (index > -1) {
      selectedElements.splice(index, 1);
    } else {
      selectedElements.push(value);
    }

    this.setData({ selectedElements });
  },

  saveToCollection() {
    const { currentShow } = this.data;
    if (!currentShow) {
      wx.showToast({ title: 'Search a series first', icon: 'none' });
      return;
    }

    const showToSave = this.normalizeShowItem(currentShow);
    const showList = [...this.data.showList];
    const exists = showList.some((item) => item.id === showToSave.id || item.title === showToSave.title);

    if (exists) {
      wx.showToast({ title: 'Already added', icon: 'none' });
      return;
    }

    showList.unshift(showToSave);
    this.setData({ showList });
    this.updateRowCount();
    wx.setStorageSync('showList', showList);
    wx.showToast({ title: 'Added', icon: 'success' });
  },

  onPullDownRefresh() {
    const showNames = this.data.showList.map((item) => item.name || item.title).filter(Boolean);
    if (showNames.length) {
      this.batchQueryShowDetails(showNames);
    }
    wx.stopPullDownRefresh();
  },

  onLoad(options) {
    if (options.name) {
      this.setData({ searchName: options.name }, () => this.searchShow());
    }

    this.loadFromLocalCache();

    const showNames = this.data.showList.map((item) => item.name || item.title).filter(Boolean);
    if (showNames.length) {
      setTimeout(() => this.batchQueryShowDetails(showNames), 300);
    }
  },

  onShow() {
    const hasDataChanged = wx.getStorageSync('showDataChanged') || false;
    if (hasDataChanged) {
      this.loadFromLocalCache();
      wx.removeStorageSync('showDataChanged');
    }
  }
});
