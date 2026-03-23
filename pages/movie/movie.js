Page({
  data: {
    currentMovie: null,
    searchName: '',
    searchResult: null,
    searchHistory: [],
    loading: false,
    detailLoading: false,
    errorMsg: '',
    movieList: [],
    selectedElements: [],
    rowCount: 0
  },

  getBackendUrl() {
    const app = getApp();
    return app && typeof app.getBackendUrl === 'function'
      ? app.getBackendUrl()
      : 'http://localhost:5000';
  },

  buildFallbackMovie(name) {
    const title = String(name || '').trim() || 'Untitled Movie';
    return {
      id: `custom_movie_${Date.now()}`,
      name: title,
      title,
      coverUrl: '',
      cover_url: '',
      rating: 'N/A',
      genres: 'Unknown',
      year: '',
      director: '',
      actors: [],
      duration: 'Unknown',
      country: 'Unknown',
      type: 'movie',
      content_type: 'movie',
      comment: 'No comment',
      selectedElements: ['Unknown']
    };
  },

  normalizeMovieItem(item = {}) {
    return {
      id: item.id || `custom_movie_${Date.now()}`,
      name: item.name || item.title || 'Untitled Movie',
      title: item.title || item.name || 'Untitled Movie',
      coverUrl: item.coverUrl || item.cover_url || item.image || '',
      cover_url: item.cover_url || item.coverUrl || item.image || '',
      rating: item.rating || item.rate || 'N/A',
      genres: item.genres || item.type || 'Unknown',
      year: item.year || item.release_date || '',
      director: item.director || '',
      actors: item.actors || [],
      duration: item.duration || 'Unknown',
      country: item.country || 'Unknown',
      type: item.type || 'movie',
      content_type: item.content_type || 'movie',
      comment: item.comment || 'No comment'
    };
  },

  updateRowCount() {
    this.setData({
      rowCount: Math.ceil((this.data.movieList.length || 0) / 2)
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
    wx.setStorageSync('movieSearchHistory', searchHistory);
  },

  searchMovie() {
    const searchName = String(this.data.searchName || '').trim();
    if (!searchName) {
      wx.showToast({ title: '请输入电影名称', icon: 'none' });
      return;
    }

    this.setData({
      loading: true,
      errorMsg: '',
      searchResult: null
    });

    wx.request({
      url: `${this.getBackendUrl()}/api/get-movie-by-name`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { name: searchName },
      success: (res) => {
        this.setData({ loading: false });

        if (res.data && res.data.code === 0 && res.data.data) {
          const movieData = this.normalizeMovieItem(res.data.data);
          this.setData({
            searchResult: movieData,
            currentMovie: movieData
          });
          this.appendSearchHistory(searchName);
          return;
        }

        const fallbackMovie = this.buildFallbackMovie(searchName);
        this.setData({
          searchResult: fallbackMovie,
          currentMovie: fallbackMovie,
          errorMsg: 'Not found in database. Created with default info.'
        });
        this.appendSearchHistory(searchName);
        wx.showToast({ title: 'Created default item', icon: 'none' });
      },
      fail: () => {
        const fallbackMovie = this.buildFallbackMovie(searchName);
        this.setData({
          loading: false,
          searchResult: fallbackMovie,
          currentMovie: fallbackMovie,
          errorMsg: 'Request failed. Created with default info.'
        });
        this.appendSearchHistory(searchName);
        wx.showToast({ title: 'Created default item', icon: 'none' });
      }
    });
  },

  loadFromLocalCache() {
    let movieList = wx.getStorageSync('movieList') || [];
    movieList = movieList
      .filter((item) => item && (item.id || item.title || item.name))
      .map((item) => this.normalizeMovieItem(item));

    this.setData({
      movieList,
      searchHistory: wx.getStorageSync('movieSearchHistory') || []
    });
    this.updateRowCount();
  },

  batchQueryMovieDetails(movieNames) {
    if (!movieNames || !movieNames.length) {
      return;
    }

    this.setData({ detailLoading: true });
    wx.request({
      url: `${this.getBackendUrl()}/api/get-movies-by-names`,
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: {
        names: movieNames,
        onlyReturnRequested: true
      },
      success: (res) => {
        this.setData({ detailLoading: false });
        if (!(res.data && res.data.code === 0 && Array.isArray(res.data.results))) {
          return;
        }

        const movieList = res.data.results.map((entry) => {
          if (entry && entry.data) {
            return this.normalizeMovieItem({
              ...entry.data,
              title: entry.data.title || entry.matched_title,
              name: entry.data.name || entry.matched_title
            });
          }
          return this.buildFallbackMovie(entry?.name_requested || entry?.matched_title || '');
        });

        this.setData({ movieList });
        wx.setStorageSync('movieList', movieList);
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
    this.setData({ searchName: name }, () => this.searchMovie());
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
        wx.setStorageSync('movieSearchHistory', []);
        wx.showToast({ title: 'Cleared', icon: 'none' });
      }
    });
  },

  batchSearchMovies() {
    if (!this.data.searchHistory.length) {
      wx.showToast({ title: 'No history to query', icon: 'none' });
      return;
    }
    this.batchQueryMovieDetails(this.data.searchHistory);
  },

  deleteMovie(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    wx.showModal({
      title: 'Confirm',
      content: 'Delete this movie?',
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const movieList = this.data.movieList.filter((item) => item.id !== id && item.name !== name);
        this.setData({ movieList });
        wx.setStorageSync('movieList', movieList);
        this.updateRowCount();
        wx.showToast({ title: 'Deleted', icon: 'none' });
      }
    });
  },

  batchDelete() {
    const { selectedElements, movieList } = this.data;
    if (!selectedElements.length) {
      wx.showToast({ title: 'Select movies first', icon: 'none' });
      return;
    }

    wx.showModal({
      title: 'Confirm',
      content: `Delete ${selectedElements.length} selected movies?`,
      success: (res) => {
        if (!res.confirm) {
          return;
        }

        const newMovieList = movieList.filter((item) => (
          !selectedElements.includes(item.id) && !selectedElements.includes(item.name)
        ));
        this.setData({
          movieList: newMovieList,
          selectedElements: []
        });
        wx.setStorageSync('movieList', newMovieList);
        this.updateRowCount();
        wx.showToast({ title: 'Deleted', icon: 'none' });
      }
    });
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
    const { currentMovie } = this.data;
    if (!currentMovie) {
      wx.showToast({ title: 'Search a movie first', icon: 'none' });
      return;
    }

    const movieToSave = this.normalizeMovieItem(currentMovie);
    const movieList = [...this.data.movieList];
    const exists = movieList.some((item) => item.id === movieToSave.id || item.title === movieToSave.title);

    if (exists) {
      wx.showToast({ title: 'Already added', icon: 'none' });
      return;
    }

    movieList.unshift(movieToSave);
    this.setData({ movieList });
    this.updateRowCount();
    wx.setStorageSync('movieList', movieList);
    wx.showToast({ title: 'Added', icon: 'success' });
  },

  onPullDownRefresh() {
    const movieNames = this.data.movieList.map((item) => item.name || item.title).filter(Boolean);
    if (movieNames.length) {
      this.batchQueryMovieDetails(movieNames);
    }
    wx.stopPullDownRefresh();
  },

  onLoad(options) {
    if (options.name) {
      this.setData({ searchName: options.name }, () => this.searchMovie());
    }

    this.loadFromLocalCache();

    const movieNames = this.data.movieList.map((item) => item.name || item.title).filter(Boolean);
    if (movieNames.length) {
      setTimeout(() => this.batchQueryMovieDetails(movieNames), 300);
    }
  },

  onShow() {
    const hasDataChanged = wx.getStorageSync('movieDataChanged') || false;
    if (hasDataChanged) {
      this.loadFromLocalCache();
      wx.removeStorageSync('movieDataChanged');
    }
  }
});
