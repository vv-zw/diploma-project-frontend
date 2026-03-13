Page({
  data: {
    // 当前选中的电影
    currentMovie: null,
    // 搜索框输入的电影名
    searchName: '',
    // 查询结果
    searchResult: null,
    // 历史查询记录
    searchHistory: [],
    // 加载状态
    loading: false,
    detailLoading: false,
    errorMsg: '',
    // 电影列表（用于展示收藏或查询结果）
    movieList: [],
    selectedElements: [], // 选中的电影ID
    rowCount: 0 // 网格布局行数
  },

  // 更新行数计算（用于网格布局）
  updateRowCount() {
    const rowCount = Math.ceil((this.data.movieList.length || 0) / 2);
    this.setData({ rowCount });
    console.log('更新电影列表行数:', rowCount);
  },

  // 监听搜索框输入
  onSearchInput(e) {
    this.setData({
      searchName: e.detail.value
    });
  },

  // 根据电影名查询详细信息
  searchMovie() {
    const { searchName } = this.data;
    
    if (!searchName.trim()) {
      wx.showToast({
        title: '请输入电影名称',
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
      url: 'http://localhost:5000/api/get-movie-by-name',
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
          const movieData = res.data.data;
          
          this.setData({
            searchResult: movieData,
            currentMovie: movieData
          });
          
          // 添加到电影列表
          let { movieList } = this.data;
          const exists = movieList.some(item => item.id === movieData.id);
          if (!exists) {
            movieList.unshift(movieData);
            this.setData({ movieList });
            this.updateRowCount();
            // 保存到本地缓存
            wx.setStorageSync('movieList', movieList);
          }
          
          // 添加到历史记录
          const { searchHistory } = this.data;
          if (!searchHistory.includes(searchName.trim())) {
            searchHistory.unshift(searchName.trim());
            if (searchHistory.length > 10) {
              searchHistory.pop();
            }
            this.setData({ searchHistory });
            wx.setStorageSync('movieSearchHistory', searchHistory);
          }
          
        } else {
          // 查询失败
          this.setData({
            errorMsg: res.data?.error || '未找到该电影信息'
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
        console.error('查询电影失败:', err);
      }
    });
  },

  // 从本地缓存加载数据
  loadFromLocalCache() {
    try {
      // 加载电影列表
      let movieList = wx.getStorageSync('movieList') || [];
      // 过滤掉无效数据
      movieList = movieList.filter(item => item && item.id);
      
      // 加载历史记录
      let searchHistory = wx.getStorageSync('movieSearchHistory') || [];
      
      this.setData({
        movieList,
        searchHistory
      });
      
      this.updateRowCount();
      console.log('从本地缓存加载电影数据，数量:', movieList.length);
    } catch (e) {
      console.error('加载缓存数据出错:', e);
      this.setData({
        movieList: [],
        searchHistory: []
      });
    }
  },

  // 批量查询电影详情
  batchQueryMovieDetails(movieNames) {
    if (!movieNames || movieNames.length === 0) return;
    
    this.setData({ detailLoading: true });
    
    wx.request({
      url: 'http://localhost:5000/api/get-movies-by-names',
      method: 'POST',
      header: {
        'content-type': 'application/json'
      },
      data: {
        names: movieNames
      },
      success: (res) => {
        this.setData({ detailLoading: false });
        
        if (res.data.code === 0 && res.data.results && Array.isArray(res.data.results)) {
          // 过滤掉data为null或undefined的项
          const validResults = res.data.results.filter(item => item && item.data);
          
          // 更新电影列表中的详情信息
          const movieList = validResults.map(item => ({
            id: item.data.id || '',
            name: item.matched_title || item.data.name || item.data.title || '',
            title: item.data.title || item.data.name || item.matched_title || '',
            coverUrl: item.data.cover_url || item.data.image || '',
            rating: item.data.rating || item.data.rate || '暂无评分',
            genres: item.data.genres || item.data.type || '未知类型',
            year: item.data.year || item.data.release_date || '',
            director: item.data.director || '',
            actors: item.data.actors || [],
            duration: item.data.duration || '未知时长',
            country: item.data.country || '未知国家'
          }));
          
          this.setData({ movieList });
          
          // 保存到本地缓存
          wx.setStorageSync('movieList', movieList);
          this.updateRowCount();
          
          // 如果有无效结果，给出提示
          if (validResults.length < res.data.results.length) {
            wx.showToast({
              title: `部分电影查询失败`,
              icon: 'none'
            });
          }
        }
      },
      fail: (err) => {
        console.error('批量查询电影详情失败:', err);
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
      this.searchMovie();
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
          wx.setStorageSync('movieSearchHistory', []);
          wx.showToast({ title: '已清空历史记录', icon: 'none' });
        }
      }
    });
  },

  // 批量查询多个电影
  batchSearchMovies() {
    // 从历史记录中批量查询
    const { searchHistory } = this.data;
    if (searchHistory.length === 0) {
      wx.showToast({
        title: '暂无历史记录可查询',
        icon: 'none'
      });
      return;
    }
    
    this.batchQueryMovieDetails(searchHistory);
  },

  // 删除电影
  deleteMovie(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这部电影吗？',
      success: (res) => {
        if (res.confirm) {
          // 本地删除
          let { movieList } = this.data;
          movieList = movieList.filter(item => 
            item.id !== id && item.name !== name
          );
          this.setData({ movieList });
          wx.setStorageSync('movieList', movieList);
          this.updateRowCount();
          
          wx.showToast({ title: '删除成功', icon: 'none' });
        }
      }
    });
  },

  // 批量删除
  batchDelete() {
    const { selectedElements, movieList } = this.data;
    
    if (selectedElements.length === 0) {
      wx.showToast({ title: '请先选择要删除的电影', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认批量删除',
      content: `确定要删除选中的${selectedElements.length}部电影吗？`,
      success: (res) => {
        if (res.confirm) {
          const newMovieList = movieList.filter(item => 
            !selectedElements.includes(item.id) && 
            !selectedElements.includes(item.name)
          );
          this.setData({ 
            movieList: newMovieList,
            selectedElements: [] 
          });
          wx.setStorageSync('movieList', newMovieList);
          this.updateRowCount();
          
          wx.showToast({ title: '批量删除成功', icon: 'none' });
        }
      }
    });
  },

  // 处理单个复选框点击（修复多选功能）
  handleCheckboxTap(e) {
    const value = e.currentTarget.dataset.value;
    let { selectedElements } = this.data;
    
    const index = selectedElements.indexOf(value);
    if (index > -1) {
      // 取消选择
      selectedElements.splice(index, 1);
    } else {
      // 添加选择
      selectedElements.push(value);
    }
    
    this.setData({ selectedElements });
  },

  // 保存当前电影到收藏
  saveToCollection() {
    const { currentMovie } = this.data;
    
    if (!currentMovie) {
      wx.showToast({
        title: '请先查询电影',
        icon: 'none'
      });
      return;
    }
    
    // 添加到电影列表
    let { movieList } = this.data;
    const exists = movieList.some(item => item.id === currentMovie.id);
    
    if (exists) {
      wx.showToast({
        title: '已添加到列表',
        icon: 'none'
      });
      return;
    }
    
    movieList.unshift(currentMovie);
    this.setData({ movieList });
    this.updateRowCount();
    
    // 保存到本地缓存
    wx.setStorageSync('movieList', movieList);
    
    wx.showToast({
      title: '添加成功',
      icon: 'success'
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    const { movieList } = this.data;
    if (movieList.length > 0) {
      const movieNames = movieList.map(item => item.name || item.title).filter(name => name);
      if (movieNames.length > 0) {
        this.batchQueryMovieDetails(movieNames);
      } else {
        wx.stopPullDownRefresh();
      }
    } else {
      wx.stopPullDownRefresh();
    }
  },

  // 页面加载时获取历史记录
  onLoad(options) {
    // 如果页面跳转时带了电影名参数
    if (options.name) {
      this.setData({
        searchName: options.name
      }, () => {
        this.searchMovie();
      });
    }
    
    // 从本地缓存加载数据
    this.loadFromLocalCache();
    
    // 如果有电影列表，批量查询详情
    const { movieList } = this.data;
    if (movieList.length > 0) {
      const movieNames = movieList.map(item => item.name || item.title).filter(name => name);
      if (movieNames.length > 0) {
        // 延迟执行，避免页面加载时卡顿
        setTimeout(() => {
          this.batchQueryMovieDetails(movieNames);
        }, 300);
      }
    }
  },

  onShow() {
    // 检查是否有数据变更
    const hasDataChanged = wx.getStorageSync('movieDataChanged') || false;
    if (hasDataChanged) {
      this.loadFromLocalCache();
      wx.removeStorageSync('movieDataChanged');
    }
  }
});