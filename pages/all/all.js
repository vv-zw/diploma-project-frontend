Page({
  data: {
    totalList: [],
    selectedElements: [],
    loading: true,
    rowCount: 0
  },

  onLoad() {
    this.loadTotalData(true);
  },

  onShow() {
    const hasDataChanged = wx.getStorageSync('totalDataChanged') || false;
    if (hasDataChanged) {
      this.loadTotalData(true);
      wx.removeStorageSync('totalDataChanged');
      return;
    }
    this.loadTotalData(false);
  },

  getBackendUrl() {
    const app = getApp();
    return app && typeof app.getBackendUrl === 'function'
      ? app.getBackendUrl()
      : 'http://localhost:5000';
  },

  buildFallbackItem(name, contentType) {
    const title = String(name || '').trim() || 'Untitled';
    return {
      id: `${contentType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      title,
      name: title,
      rating: 'N/A',
      genres: 'Unknown',
      year: '',
      type: contentType,
      content_type: contentType,
      coverUrl: '',
      cover_url: '',
      selectedElements: ['Unknown'],
      comment: 'No comment'
    };
  },

  normalizeTotalItem(item = {}, forcedType = '') {
    const contentType = forcedType || item.content_type || item.type || 'movie';
    let selectedElements = item.selectedElements || item.genres || [];

    if (typeof selectedElements === 'string') {
      selectedElements = selectedElements
        .split(/[,/|、，]/)
        .map((value) => value.trim())
        .filter(Boolean);
    }

    if (!Array.isArray(selectedElements)) {
      selectedElements = [];
    }

    const title = item.title || item.name || 'Untitled';
    const rawId = String(item.id || title).trim();

    return {
      ...item,
      id: rawId,
      name: item.name || title,
      title,
      type: contentType,
      content_type: contentType,
      rating: item.rating || item.rate || item.score || 'N/A',
      genres: item.genres || (selectedElements.length ? selectedElements.join(' / ') : 'Unknown'),
      year: item.year || item.release_date || '',
      coverUrl: item.coverUrl || item.cover_url || item.image || '',
      cover_url: item.cover_url || item.coverUrl || item.image || '',
      selectedElements,
      uniqueId: `${contentType}:${rawId}`
    };
  },

  updateRowCount() {
    this.setData({
      rowCount: Math.ceil((this.data.totalList.length || 0) / 2)
    });
  },

  getMovieList() {
    return (wx.getStorageSync('movieList') || []).map((item) => this.normalizeTotalItem(item, 'movie'));
  },

  getShowList() {
    return (wx.getStorageSync('showList') || []).map((item) => this.normalizeTotalItem(item, 'series'));
  },

  updateCombinedStorage(movieList, showList) {
    const totalMovieList = [...movieList, ...showList];
    wx.setStorageSync('movieList', movieList);
    wx.setStorageSync('showList', showList);
    wx.setStorageSync('totalMovieList', totalMovieList);
  },

  loadTotalData(forceRefresh = false) {
    const movieList = this.getMovieList();
    const showList = this.getShowList();
    const totalList = [...movieList, ...showList];

    this.setData({
      totalList,
      loading: false,
      selectedElements: this.data.selectedElements.filter((key) => totalList.some((item) => item.uniqueId === key))
    });
    this.updateRowCount();

    if (forceRefresh) {
      this.syncMovieDetails(movieList);
      this.syncShowDetails(showList);
    }
  },

  syncMovieDetails(movieList) {
    const movieNames = (movieList || []).map((item) => item.name || item.title).filter(Boolean);
    if (!movieNames.length) {
      return;
    }

    wx.request({
      url: `${this.getBackendUrl()}/api/get-movies-by-names`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        names: movieNames,
        onlyReturnRequested: true
      },
      success: (res) => {
        if (!(res.data && res.data.code === 0 && Array.isArray(res.data.results))) {
          return;
        }

        const updatedMovies = res.data.results.map((entry) => {
          if (entry && entry.data) {
            return this.normalizeTotalItem({
              ...entry.data,
              title: entry.data.title || entry.matched_title,
              name: entry.data.name || entry.matched_title
            }, 'movie');
          }

          return this.normalizeTotalItem(
            this.buildFallbackItem(entry?.name_requested || entry?.matched_title || '', 'movie'),
            'movie'
          );
        });

        this.updateCombinedStorage(updatedMovies, this.getShowList());
        this.loadTotalData(false);
      }
    });
  },

  syncShowDetails(showList) {
    const showNames = (showList || []).map((item) => item.name || item.title).filter(Boolean);
    if (!showNames.length) {
      return;
    }

    wx.request({
      url: `${this.getBackendUrl()}/api/get-dramas-by-names`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        names: showNames,
        onlyReturnRequested: true
      },
      success: (res) => {
        if (!(res.data && res.data.code === 0 && Array.isArray(res.data.results))) {
          return;
        }

        const updatedShows = res.data.results.map((entry) => {
          if (entry && entry.data) {
            return this.normalizeTotalItem({
              ...entry.data,
              title: entry.data.title || entry.matched_title,
              name: entry.data.name || entry.matched_title
            }, 'series');
          }

          return this.normalizeTotalItem(
            this.buildFallbackItem(entry?.name_requested || entry?.matched_title || '', 'series'),
            'series'
          );
        });

        this.updateCombinedStorage(this.getMovieList(), updatedShows);
        this.loadTotalData(false);
      }
    });
  },

  selectItem(e) {
    const key = e.currentTarget.dataset.key;
    if (!key) {
      return;
    }

    const selectedElements = [...this.data.selectedElements];
    const index = selectedElements.indexOf(key);
    if (index >= 0) {
      selectedElements.splice(index, 1);
    } else {
      selectedElements.push(key);
    }

    this.setData({ selectedElements });
  },

  toggleSelectAll() {
    const { totalList, selectedElements } = this.data;
    if (!totalList.length) {
      return;
    }

    if (selectedElements.length === totalList.length) {
      this.setData({ selectedElements: [] });
      return;
    }

    this.setData({
      selectedElements: totalList.map((item) => item.uniqueId)
    });
  },

  deleteItem(e) {
    const key = e.currentTarget.dataset.key;
    const item = this.data.totalList.find((entry) => entry.uniqueId === key);
    if (!item) {
      return;
    }

    wx.showModal({
      title: 'Delete',
      content: `Delete "${item.title || item.name}"?`,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        this.removeItemsByKeys([key]);
        wx.showToast({ title: 'Deleted', icon: 'none' });
      }
    });
  },

  batchDelete() {
    const { selectedElements } = this.data;
    if (!selectedElements.length) {
      wx.showToast({ title: 'Select items first', icon: 'none' });
      return;
    }

    wx.showModal({
      title: 'Delete',
      content: `Delete ${selectedElements.length} selected items?`,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        this.removeItemsByKeys(selectedElements);
        wx.showToast({ title: 'Deleted', icon: 'none' });
      }
    });
  },

  removeItemsByKeys(keys) {
    const keySet = new Set(keys);
    const movieList = this.getMovieList().filter((item) => !keySet.has(item.uniqueId));
    const showList = this.getShowList().filter((item) => !keySet.has(item.uniqueId));
    const alreadyList = (wx.getStorageSync('alreadyList') || []).filter((item) => {
      const normalized = this.normalizeTotalItem(item, item.content_type || item.type || 'movie');
      return !keySet.has(normalized.uniqueId);
    });

    wx.setStorageSync('alreadyList', alreadyList);
    wx.setStorageSync('totalDataChanged', true);
    this.updateCombinedStorage(movieList, showList);
    this.setData({ selectedElements: [] });
    this.loadTotalData(false);
  },

  clearAllData() {
    wx.showModal({
      title: 'Clear',
      content: 'Clear all movie, series and watchlist data?',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        wx.setStorageSync('movieList', []);
        wx.setStorageSync('showList', []);
        wx.setStorageSync('alreadyList', []);
        wx.setStorageSync('totalMovieList', []);
        wx.setStorageSync('totalDataChanged', true);

        this.setData({
          totalList: [],
          selectedElements: []
        });
        this.updateRowCount();
        wx.showToast({ title: 'Cleared', icon: 'none' });
      }
    });
  }
});
