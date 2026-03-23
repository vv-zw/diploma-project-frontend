Page({
  data: {
    currentMovie: null,
    searchName: "",
    searchResult: null,
    searchHistory: [],
    loading: false,
    detailLoading: false,
    errorMsg: "",
    movieList: [],
    selectedElements: [],
    rowCount: 0
  },

  getBackendUrl() {
    const app = getApp();
    return app && typeof app.getBackendUrl === "function"
      ? app.getBackendUrl()
      : "http://localhost:5000";
  },

  buildFallbackMovie(name) {
    const normalizedName = String(name || "").trim();
    return {
      id: `custom_movie_${Date.now()}`,
      name: normalizedName,
      title: normalizedName,
      coverUrl: "",
      cover_url: "",
      rating: "暂无评分",
      genres: "未分类",
      year: "",
      director: "",
      actors: [],
      duration: "未知时长",
      country: "未知国家",
      type: "电影",
      content_type: "movie",
      comment: "暂无短评",
      selectedElements: ["未分类"]
    };
  },

  normalizeMovieItem(item = {}) {
    return {
      id: item.id || `custom_movie_${Date.now()}`,
      name: item.name || item.title || "未命名电影",
      title: item.title || item.name || "未命名电影",
      coverUrl: item.coverUrl || item.cover_url || item.image || "",
      cover_url: item.cover_url || item.coverUrl || item.image || "",
      rating: item.rating || item.rate || "暂无评分",
      genres: item.genres || item.type || "未分类",
      year: item.year || item.release_date || "",
      director: item.director || "",
      actors: item.actors || [],
      duration: item.duration || "未知时长",
      country: item.country || "未知国家",
      type: item.type || "电影",
      content_type: item.content_type || "movie",
      comment: item.comment || "暂无短评"
    };
  },

  updateRowCount() {
    const rowCount = Math.ceil((this.data.movieList.length || 0) / 2);
    this.setData({ rowCount });
  },

  onSearchInput(e) {
    this.setData({
      searchName: e.detail.value
    });
  },

  appendSearchHistory(name) {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) {
      return;
    }
    const searchHistory = this.data.searchHistory.filter((item) => item !== normalizedName);
    searchHistory.unshift(normalizedName);
    if (searchHistory.length > 10) {
      searchHistory.length = 10;
    }
    this.setData({ searchHistory });
    wx.setStorageSync("movieSearchHistory", searchHistory);
  },

  searchMovie() {
    const searchName = String(this.data.searchName || "").trim();

    if (!searchName) {
      wx.showToast({
        title: "请输入电影名称",
        icon: "none"
      });
      return;
    }

    this.setData({
      loading: true,
      errorMsg: "",
      searchResult: null
    });

    wx.request({
      url: `${this.getBackendUrl()}/api/get-movie-by-name`,
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        name: searchName
      },
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
          errorMsg: "数据库中未找到该影片，已使用默认信息创建",
          loading: false
        });
        this.appendSearchHistory(searchName);
        wx.showToast({
          title: "已创建默认影片信息",
          icon: "none"
        });
      },
      fail: (err) => {
        const fallbackMovie = this.buildFallbackMovie(searchName);
        this.setData({
          loading: false,
          searchResult: fallbackMovie,
          currentMovie: fallbackMovie,
          errorMsg: "网络请求失败，已使用默认信息创建"
        });
        this.appendSearchHistory(searchName);
        wx.showToast({
          title: "已创建默认影片信息",
          icon: "none"
        });
        console.error("查询电影失败:", err);
      }
    });
  },

  loadFromLocalCache() {
    try {
      let movieList = wx.getStorageSync("movieList") || [];
      movieList = movieList.filter((item) => item && (item.id || item.title || item.name)).map((item) => this.normalizeMovieItem(item));
      const searchHistory = wx.getStorageSync("movieSearchHistory") || [];

      this.setData({
        movieList,
        searchHistory
      });

      this.updateRowCount();
    } catch (e) {
      console.error("加载缓存数据出错:", e);
      this.setData({
        movieList: [],
        searchHistory: []
      });
    }
  },

  batchQueryMovieDetails(movieNames) {
    if (!movieNames || movieNames.length === 0) return;

    this.setData({ detailLoading: true });

    wx.request({
      url: `${this.getBackendUrl()}/api/get-movies-by-names`,
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        names: movieNames,
        onlyReturnRequested: true
      },
      success: (res) => {
        this.setData({ detailLoading: false });

        if (res.data.code === 0 && Array.isArray(res.data.results)) {
          const movieList = res.data.results.map((item) => {
            if (item && item.data) {
              return this.normalizeMovieItem({
                ...item.data,
                title: item.data.title || item.matched_title,
                name: item.data.name || item.matched_title
              });
            }
            return this.buildFallbackMovie(item?.name_requested || item?.matched_title || "");
          });

          this.setData({ movieList });
          wx.setStorageSync("movieList", movieList);
          this.updateRowCount();
        }
      },
      fail: (err) => {
        console.error("批量查询电影详情失败:", err);
        this.setData({ detailLoading: false });
        wx.showToast({
          title: "批量查询失败",
          icon: "none"
        });
      }
    });
  },

  selectFromHistory(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({
      searchName: name
    }, () => {
      this.searchMovie();
    });
  },

  clearHistory() {
    wx.showModal({
      title: "确认清空",
      content: "确定要清空所有历史记录吗？",
      success: (res) => {
        if (res.confirm) {
          this.setData({ searchHistory: [] });
          wx.setStorageSync("movieSearchHistory", []);
          wx.showToast({ title: "已清空历史记录", icon: "none" });
        }
      }
    });
  },

  batchSearchMovies() {
    const { searchHistory } = this.data;
    if (searchHistory.length === 0) {
      wx.showToast({
        title: "暂无历史记录可查询",
        icon: "none"
      });
      return;
    }

    this.batchQueryMovieDetails(searchHistory);
  },

  deleteMovie(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: "确认删除",
      content: "确定要删除这部电影吗？",
      success: (res) => {
        if (res.confirm) {
          let { movieList } = this.data;
          movieList = movieList.filter((item) => item.id !== id && item.name !== name);
          this.setData({ movieList });
          wx.setStorageSync("movieList", movieList);
          this.updateRowCount();

          wx.showToast({ title: "删除成功", icon: "none" });
        }
      }
    });
  },

  batchDelete() {
    const { selectedElements, movieList } = this.data;

    if (selectedElements.length === 0) {
      wx.showToast({ title: "请先选择要删除的电影", icon: "none" });
      return;
    }

    wx.showModal({
      title: "确认批量删除",
      content: `确定要删除选中的 ${selectedElements.length} 部电影吗？`,
      success: (res) => {
        if (res.confirm) {
          const newMovieList = movieList.filter((item) => (
            !selectedElements.includes(item.id) && !selectedElements.includes(item.name)
          ));
          this.setData({
            movieList: newMovieList,
            selectedElements: []
          });
          wx.setStorageSync("movieList", newMovieList);
          this.updateRowCount();
          wx.showToast({ title: "批量删除成功", icon: "none" });
        }
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
      wx.showToast({
        title: "请先查询电影",
        icon: "none"
      });
      return;
    }

    const movieToSave = this.normalizeMovieItem(currentMovie);
    let { movieList } = this.data;
    const exists = movieList.some((item) => item.id === movieToSave.id || item.title === movieToSave.title);

    if (exists) {
      wx.showToast({
        title: "已添加到列表",
        icon: "none"
      });
      return;
    }

    movieList.unshift(movieToSave);
    this.setData({ movieList });
    this.updateRowCount();
    wx.setStorageSync("movieList", movieList);
    wx.showToast({
      title: "添加成功",
      icon: "success"
    });
  },

  onPullDownRefresh() {
    const { movieList } = this.data;
    if (movieList.length > 0) {
      const movieNames = movieList.map((item) => item.name || item.title).filter((name) => name);
      if (movieNames.length > 0) {
        this.batchQueryMovieDetails(movieNames);
      } else {
        wx.stopPullDownRefresh();
      }
    } else {
      wx.stopPullDownRefresh();
    }
  },

  onLoad(options) {
    if (options.name) {
      this.setData({
        searchName: options.name
      }, () => {
        this.searchMovie();
      });
    }

    this.loadFromLocalCache();

    const { movieList } = this.data;
    if (movieList.length > 0) {
      const movieNames = movieList.map((item) => item.name || item.title).filter((name) => name);
      if (movieNames.length > 0) {
        setTimeout(() => {
          this.batchQueryMovieDetails(movieNames);
        }, 300);
      }
    }
  },

  onShow() {
    const hasDataChanged = wx.getStorageSync("movieDataChanged") || false;
    if (hasDataChanged) {
      this.loadFromLocalCache();
      wx.removeStorageSync("movieDataChanged");
    }
  }
});
