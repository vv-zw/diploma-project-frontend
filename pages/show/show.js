Page({
  data: {
    // 当前选中的剧集
    currentShow: null,
    // 搜索框输入的剧集名
    searchName: '',
    // 查询结果
    searchResult: null,
    // 历史查询记录
    searchHistory: [],
    // 加载状态
    loading: false,
    detailLoading: false,
    errorMsg: '',
    // 剧集列表（用于展示收藏或查询结果）
    showList: [],
    selectedElements: [], // 选中的剧集ID
    rowCount: 0 // 网格布局行数
  },

  // 更新行数计算（用于网格布局）
  updateRowCount() {
    const rowCount = Math.ceil((this.data.showList.length || 0) / 2);
    this.setData({ rowCount });
    console.log('更新剧集列表行数:', rowCount);
  },

  // 监听搜索框输入
  onSearchInput(e) {
    this.setData({
      searchName: e.detail.value
    });
  },

  // 根据剧集名查询详细信息
  searchShow() {
    const { searchName } = this.data;
    
    if (!searchName.trim()) {
      wx.showToast({
        title: '请输入剧集名称',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      loading: true,
      errorMsg: '',
      searchResult: null
    });
    
    wx.request({
      url: 'http://localhost:5000/api/get-drama-by-name',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        name: searchName.trim()
      },
      success: (res) => {
        this.setData({ loading: false });
        
        if (res.data && res.data.code === 0 && res.data.data) {
          // 查询成功
          const showData = res.data.data;
          
          this.setData({
            searchResult: showData,
            currentShow: showData
          });
          
          // 添加到剧集列表
          let { showList } = this.data;
          const exists = showList.some(item => item.id === showData.id);
          if (!exists) {
            showList.unshift(showData);
            this.setData({ showList });
            this.updateRowCount();
            // 保存到本地缓存
            wx.setStorageSync('showList', showList);
          }
          
          // 添加到历史记录
          const { searchHistory } = this.data;
          if (!searchHistory.includes(searchName.trim())) {
            searchHistory.unshift(searchName.trim());
            if (searchHistory.length > 10) {
              searchHistory.pop();
            }
            this.setData({ searchHistory });
            wx.setStorageSync('showSearchHistory', searchHistory);
          }
          
        } else {
          // 查询失败
          this.setData({
            errorMsg: res.data?.error || '未找到该剧集信息'
          });
          wx.showToast({
            title: this.data.errorMsg,
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        this.setData({
          loading: false,
          errorMsg: '网络请求失败，请重试'
        });
        wx.showToast({
          title: this.data.errorMsg,
          icon: 'none'
        });
        console.error('查询剧集失败:', err);
      }
    });
  },

  // 从本地缓存加载数据
  loadFromLocalCache() {
    try {
      // 加载剧集列表
      let showList = wx.getStorageSync('showList') || [];
      // 过滤掉无效数据
      showList = showList.filter(item => item && item.id);
      
      // 加载历史记录
      let searchHistory = wx.getStorageSync('showSearchHistory') || [];
      
      this.setData({
        showList,
        searchHistory
      });
      
      this.updateRowCount();
      console.log('从本地缓存加载剧集数据，数量:', showList.length);
    } catch (e) {
      console.error('加载缓存数据出错:', e);
      this.setData({
        showList: [],
        searchHistory: []
      });
    }
  },

  // 批量查询剧集详情
  batchQueryShowDetails(showNames) {
    if (!showNames || showNames.length === 0) return;
    
    this.setData({ detailLoading: true });
    
    wx.request({
      url: 'http://localhost:5000/api/get-dramas-by-names',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        names: showNames
      },
      success: (res) => {
        this.setData({ detailLoading: false });
        
        if (res.data.code === 0 && res.data.results && Array.isArray(res.data.results)) {
          // 过滤掉data为null或undefined的项
          const validResults = res.data.results.filter(item => item && item.data);
          
          // 更新剧集列表中的详情信息
          const showList = validResults.map(item => ({
            id: item.data.id || '',
            name: item.matched_title || item.data.name || item.data.title || '',
            title: item.data.title || item.data.name || item.matched_title || '',
            coverUrl: item.data.cover_url || item.data.image || '',
            rating: item.data.rating || item.data.rate || '暂无评分',
            genres: item.data.genres || item.data.type || '未知类型',
            year: item.data.year || item.data.release_date || '',
            director: item.data.director || '',
            actors: item.data.actors || [],
            episodes: item.data.episodes || '未知集数',
            region: item.data.region || '未知地区'
          }));
          
          this.setData({ showList });
          
          // 保存到本地缓存
          wx.setStorageSync('showList', showList);
          this.updateRowCount();
          
          // 如果有无效结果，给出提示
          if (validResults.length < res.data.results.length) {
            wx.showToast({
              title: `部分剧集查询失败`,
              icon: 'none'
            });
          }
        }
      },
      fail: (err) => {
        console.error('批量查询剧集详情失败:', err);
        this.setData({ detailLoading: false });
        wx.showToast({
          title: '批量查询失败',
          icon: 'none'
        });
      }
    });
  },

  // 从历史记录中选择
  selectFromHistory(e) {
    const name = e.currentTarget.dataset.name;
    this.setData({
      searchName: name
    }, () => {
      this.searchShow();
    });
  },

  // 清空历史记录
  clearHistory() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ searchHistory: [] });
          wx.setStorageSync('showSearchHistory', []);
          wx.showToast({ title: '已清空历史记录', icon: 'none' });
        }
      }
    });
  },

  // 批量查询多个剧集
  batchSearchShows() {
    // 从历史记录中批量查询
    const { searchHistory } = this.data;
    if (searchHistory.length === 0) {
      wx.showToast({
        title: '暂无历史记录可查询',
        icon: 'none'
      });
      return;
    }
    
    this.batchQueryShowDetails(searchHistory);
  },

  // 删除剧集
  deleteShow(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这部剧集吗？',
      success: (res) => {
        if (res.confirm) {
          // 本地删除
          let { showList } = this.data;
          showList = showList.filter(item => 
            item.id !== id && item.name !== name
          );
          this.setData({ showList });
          wx.setStorageSync('showList', showList);
          this.updateRowCount();
          
          wx.showToast({ title: '删除成功', icon: 'none' });
        }
      }
    });
  },

  // 批量删除
  batchDelete() {
    const { selectedElements, showList } = this.data;
    
    if (selectedElements.length === 0) {
      wx.showToast({ title: '请先选择要删除的剧集', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认批量删除',
      content: `确定要删除选中的${selectedElements.length}部剧集吗？`,
      success: (res) => {
        if (res.confirm) {
          const newShowList = showList.filter(item => 
            !selectedElements.includes(item.id) && 
            !selectedElements.includes(item.name)
          );
          this.setData({ 
            showList: newShowList,
            selectedElements: [] 
          });
          wx.setStorageSync('showList', newShowList);
          this.updateRowCount();
          
          wx.showToast({ title: '批量删除成功', icon: 'none' });
        }
      }
    });
  },

  // 多选框状态变化
  checkboxChange(e) {
    this.setData({
      selectedElements: e.detail.value
    });
  },

  // 保存当前剧集到收藏
  saveToCollection() {
    const { currentShow } = this.data;
    
    if (!currentShow) {
      wx.showToast({
        title: '请先查询剧集',
        icon: 'none'
      });
      return;
    }
    
    // 添加到剧集列表
    let { showList } = this.data;
    const exists = showList.some(item => item.id === currentShow.id);
    
    if (exists) {
      wx.showToast({
        title: '已添加到列表',
        icon: 'none'
      });
      return;
    }
    
    showList.unshift(currentShow);
    this.setData({ showList });
    this.updateRowCount();
    
    // 保存到本地缓存
    wx.setStorageSync('showList', showList);
    
    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    const { showList } = this.data;
    if (showList.length > 0) {
      const showNames = showList.map(item => item.name || item.title).filter(name => name);
      if (showNames.length > 0) {
        this.batchQueryShowDetails(showNames);
      } else {
        wx.stopPullDownRefresh();
      }
    } else {
      wx.stopPullDownRefresh();
    }
  },

  // 页面加载时获取历史记录
  onLoad(options) {
    // 如果页面跳转时带了剧集名参数
    if (options.name) {
      this.setData({
        searchName: options.name
      }, () => {
        this.searchShow();
      });
    }
    
    // 从本地缓存加载数据
    this.loadFromLocalCache();
    
    // 如果有剧集列表，批量查询详情
    const { showList } = this.data;
    if (showList.length > 0) {
      const showNames = showList.map(item => item.name || item.title).filter(name => name);
      if (showNames.length > 0) {
        // 延迟执行，避免页面加载时卡顿
        setTimeout(() => {
          this.batchQueryShowDetails(showNames);
        }, 300);
      }
    }
  },

  onShow() {
    // 检查是否有数据变更
    const hasDataChanged = wx.getStorageSync('showDataChanged') || false;
    if (hasDataChanged) {
      this.loadFromLocalCache();
      wx.removeStorageSync('showDataChanged');
    }
  }
});