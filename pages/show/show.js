Page({
  data: {
    currentShow: null,
    searchName: "",
    searchResult: null,
    searchHistory: [],
    loading: false,
    detailLoading: false,
    errorMsg: "",
    showList: [],
    selectedElements: [],
    rowCount: 0
  },

  getBackendUrl() {
    const app = getApp();
    return app && typeof app.getBackendUrl === "function"
      ? app.getBackendUrl()
      : "http://localhost:5000";
  },

  buildFallbackShow(name) {
    const normalizedName = String(name || "").trim();
    return {
      id: `custom_series_${Date.now()}`,
      name: normalizedName,
      title: normalizedName,
      coverUrl: "",
      cover_url: "",
      rating: "暂无评分",
      genres: "未分类",
      year: "",
      director: "",
      actors: [],
      episodes: "未知集数",
      region: "未知地区",
      type: "剧集",
      content_type: "series",
      comment: "暂无短评",
      selectedElements: ["未分类"]
    };
  },

  normalizeShowItem(item = {}) {
    return {
      id: item.id || `custom_series_${Date.now()}`,
      name: item.name || item.title || "未命名剧集",
      title: item.title || item.name || "未命名剧集",
      coverUrl: item.coverUrl || item.cover_url || item.image || "",
      cover_url: item.cover_url || item.coverUrl || item.image || "",
      rating: item.rating || item.rate || "暂无评分",
      genres: item.genres || item.type || "未分类",
      year: item.year || item.release_date || "",
      director: item.director || "",
      actors: item.actors || [],
      episodes: item.episodes || "未知集数",
      region: item.region || "未知地区",
      type: item.type || "剧集",
      content_type: item.content_type || "series",
      comment: item.comment || "暂无短评"
    };
  },

  updateRowCount() {
    const rowCount = Math.ceil((this.data.showList.length || 0) / 2);
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
    wx.setStorageSync("showSearchHistory", searchHistory);
  },

  searchShow() {
    const searchName = String(this.data.searchName || "").trim();

    if (!searchName) {
      wx.showToast({
        title: "请输入剧集名称",
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
      url: `${this.getBackendUrl()}/api/get-drama-by-name`,
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
          errorMsg: "数据库中未找到该剧集，已使用默认信息创建",
          loading: false
        });
        this.appendSearchHistory(searchName);
        wx.showToast({
          title: "已创建默认剧集信息",
          icon: "none"
        });
      },
      fail: (err) => {
        const fallbackShow = this.buildFallbackShow(searchName);
        this.setData({
          loading: false,
          searchResult: fallbackShow,
          currentShow: fallbackShow,
          errorMsg: "网络请求失败，已使用默认信息创建"
        });
        this.appendSearchHistory(searchName);
        wx.showToast({
          title: "已创建默认剧集信息",
          icon: "none"
        });
        console.error("查询剧集失败:", err);
      }
    });
  },

  loadFromLocalCache() {
    try {
      let showList = wx.getStorageSync("showList") || [];
      showList = showList.filter((item) => item && (item.id || item.title || item.name)).map((item) => this.normalizeShowItem(item));
      const searchHistory = wx.getStorageSync("showSearchHistory") || [];

      this.setData({
        showList,
        searchHistory
      });

      this.updateRowCount();
    } catch (e) {
      console.error("加载缓存数据出错:", e);
      this.setData({
        showList: [],
        searchHistory: []
      });
    }
  },

  batchQueryShowDetails(showNames) {
    if (!showNames || showNames.length === 0) return;

    this.setData({ detailLoading: true });

    wx.request({
      url: `${this.getBackendUrl()}/api/get-dramas-by-names`,
      method: "POST",
      header: {
        "content-type": "application/json"
      },
      data: {
        names: showNames,
        onlyReturnRequested: true
      },
      success: (res) => {
        this.setData({ detailLoading: false });

        if (res.data.code === 0 && Array.isArray(res.data.results)) {
          const showList = res.data.results.map((item) => {
            if (item && item.data) {
              return this.normalizeShowItem({
                ...item.data,
                title: item.data.title || item.matched_title,
                name: item.data.name || item.matched_title
              });
            }
            return this.buildFallbackShow(item?.name_requested || item?.matched_title || "");
          });

          this.setData({ showList });
          wx.setStorageSync("showList", showList);
          this.updateRowCount();
        }
      },
      fail: (err) => {
        console.error("批量查询剧集详情失败:", err);
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
      this.searchShow();
    });
  },

  clearHistory() {
    wx.showModal({
      title: "确认清空",
      content: "确定要清空所有历史记录吗？",
      success: (res) => {
        if (res.confirm) {
          this.setData({ searchHistory: [] });
          wx.setStorageSync("showSearchHistory", []);
          wx.showToast({ title: "已清空历史记录", icon: "none" });
        }
      }
    });
  },

  batchSearchShows() {
    const { searchHistory } = this.data;
    if (searchHistory.length === 0) {
      wx.showToast({
        title: "暂无历史记录可查询",
        icon: "none"
      });
      return;
    }

    this.batchQueryShowDetails(searchHistory);
  },

  deleteShow(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;

    wx.showModal({
      title: "确认删除",
      content: "确定要删除这部剧集吗？",
      success: (res) => {
        if (res.confirm) {
          let { showList } = this.data;
          showList = showList.filter((item) => item.id !== id && item.name !== name);
          this.setData({ showList });
          wx.setStorageSync("showList", showList);
          this.updateRowCount();

          wx.showToast({ title: "删除成功", icon: "none" });
        }
      }
    });
  },

  batchDelete() {
    const { selectedElements, showList } = this.data;

    if (selectedElements.length === 0) {
      wx.showToast({ title: "请先选择要删除的剧集", icon: "none" });
      return;
    }

    wx.showModal({
      title: "确认批量删除",
      content: `确定要删除选中的 ${selectedElements.length} 部剧集吗？`,
      success: (res) => {
        if (res.confirm) {
          const newShowList = showList.filter((item) => (
            !selectedElements.includes(item.id) && !selectedElements.includes(item.name)
          ));
          this.setData({
            showList: newShowList,
            selectedElements: []
          });
          wx.setStorageSync("showList", newShowList);
          this.updateRowCount();
          wx.showToast({ title: "批量删除成功", icon: "none" });
        }
      }
    });
  },

  checkboxChange(e) {
    this.setData({
      selectedElements: e.detail.value
    });
  },

  saveToCollection() {
    const { currentShow } = this.data;

    if (!currentShow) {
      wx.showToast({
        title: "请先查询剧集",
        icon: "none"
      });
      return;
    }

    const showToSave = this.normalizeShowItem(currentShow);
    let { showList } = this.data;
    const exists = showList.some((item) => item.id === showToSave.id || item.title === showToSave.title);

    if (exists) {
      wx.showToast({
        title: "已添加到列表",
        icon: "none"
      });
      return;
    }

    showList.unshift(showToSave);
    this.setData({ showList });
    this.updateRowCount();
    wx.setStorageSync("showList", showList);
    wx.showToast({
      title: "添加成功",
      icon: "success"
    });
  },

  onPullDownRefresh() {
    const { showList } = this.data;
    if (showList.length > 0) {
      const showNames = showList.map((item) => item.name || item.title).filter((name) => name);
      if (showNames.length > 0) {
        this.batchQueryShowDetails(showNames);
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
        this.searchShow();
      });
    }

    this.loadFromLocalCache();

    const { showList } = this.data;
    if (showList.length > 0) {
      const showNames = showList.map((item) => item.name || item.title).filter((name) => name);
      if (showNames.length > 0) {
        setTimeout(() => {
          this.batchQueryShowDetails(showNames);
        }, 300);
      }
    }
  },

  onShow() {
    const hasDataChanged = wx.getStorageSync("showDataChanged") || false;
    if (hasDataChanged) {
      this.loadFromLocalCache();
      wx.removeStorageSync("showDataChanged");
    }
  }
});
