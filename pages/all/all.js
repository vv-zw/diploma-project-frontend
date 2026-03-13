Page({
  data: {
    totalList: [], // 全部影视数据
    selectedElements: [], // 选中的项目ID
    loading: true, // 加载状态
    syncStatus: "", // 同步状态提示
    rowCount: 0 // 用于网格布局的行数计算
  },

  onLoad() {
    // 页面加载时优先从本地缓存读取数据
    this.loadFromLocalCache();
    
    // 如果是首次加载或数据过期，重新加载并同步详细信息
    if (!this.checkLocalDataValid()) {
      this.loadTotalData(true); // 强制刷新详细数据
    } else {
      this.setData({ loading: false });
    }
  },

  onShow() {
    // 检查是否有数据变更标记
    const hasDataChanged = wx.getStorageSync('totalDataChanged') || false;
    
    if (hasDataChanged) {
      // 数据有变更，重新加载并同步详细信息
      this.loadTotalData(true);
      // 清除变更标记
      wx.removeStorageSync('totalDataChanged');
    } else {
      // 数据无变更，使用缓存
      this.loadFromLocalCache();
    }
  },

  // 更新行数计算（用于网格布局）
  updateRowCount() {
    const rowCount = Math.ceil((this.data.totalList.length || 0) / 2);
    this.setData({ rowCount });
    console.log('更新全部列表行数:', rowCount);
  },

  // 从本地缓存加载数据
  loadFromLocalCache() {
    // 加载全部影视数据缓存
    let movieList = wx.getStorageSync('movieList') || [];
    let showList = wx.getStorageSync('showList') || [];
    
    // 合并电影和剧集数据，并添加类型标识
    let totalData = [
      ...movieList.map(item => ({ ...item, type: 'movie' })),
      ...showList.map(item => ({ ...item, type: 'series' }))
    ];
    
    // 格式化数据
    totalData = this.formatTotalData(totalData);
    
    this.setData({
      totalList: totalData,
      loading: false
    });
    
    // 更新行数
    this.updateRowCount();
    
    console.log('从本地缓存加载全部数据，电影:', movieList.length, '剧集:', showList.length);
  },

  // 检查本地数据是否有效
  checkLocalDataValid() {
    const cacheTime = wx.getStorageSync('totalCacheTimestamp') || 0;
    const movieList = wx.getStorageSync('movieList') || [];
    const showList = wx.getStorageSync('showList') || [];
    
    // 缓存有效期为30分钟
    const CACHE_DURATION = 1800000; // 毫秒
    
    // 检查条件：有缓存时间、未过期、有数据
    return cacheTime > 0 && 
           (Date.now() - cacheTime) < CACHE_DURATION && 
           (movieList.length > 0 || showList.length > 0);
  },

  // 保存数据到本地缓存
  saveToLocalCache() {
    wx.setStorageSync('totalCacheTimestamp', Date.now());
    console.log('全部数据已保存到本地缓存');
  },

  // 标记数据已变更
  markDataChanged() {
    wx.setStorageSync('totalDataChanged', true);
  },

  // 格式化全部数据
  formatTotalData(data) {
    return data.map(item => {
      let elements = item.selectedElements || [];
      if (typeof elements === 'string') {
        elements = elements.split(',');
      }
      return {
        ...item,
        selectedElements: elements,
        // 兼容字段
        coverUrl: item.coverUrl || item.cover_url || item.image || '',
        name: item.name || item.title || '未知名称',
        rating: item.rating || item.rate || '暂无评分',
        genres: item.genres || item.type || '未知类型',
        year: item.year || item.release_date || '未知年份',
        // 确保ID唯一性
        uniqueId: item.type + '_' + (item.id || Math.random().toString(36).substr(2, 9))
      };
    });
  },

  // 加载全部数据
  loadTotalData(forceRefresh = false) {
    this.setData({ loading: true });
    
    // 获取最新的电影和剧集数据
    let movieList = wx.getStorageSync('movieList') || [];
    let showList = wx.getStorageSync('showList') || [];
    
    // 如果需要刷新详细信息
    if (forceRefresh) {
      this.syncMovieDetails(movieList);
      this.syncShowDetails(showList);
    }
    
    // 合并数据
    let totalData = [
      ...movieList.map(item => ({ ...item, type: 'movie' })),
      ...showList.map(item => ({ ...item, type: 'series' }))
    ];
    
    // 格式化数据
    totalData = this.formatTotalData(totalData);
    
    console.log("全部数据加载完成，总计:", totalData.length);
    
    this.setData({ 
      totalList: totalData,
      loading: false 
    });
    
    // 更新行数
    this.updateRowCount();
    
    // 保存到缓存
    this.saveToLocalCache();
  },

  // 同步电影详细信息
  syncMovieDetails(movieList) {
    if (!movieList || movieList.length === 0) return;
    
    const movieNames = movieList.map(item => item.name || item.title).filter(name => name);
    if (movieNames.length === 0) return;
    
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
        if (res.data.code === 0 && res.data.results && Array.isArray(res.data.results)) {
          const updatedMovies = res.data.results
            .filter(item => item && item.data)
            .map(item => ({
              ...item.data,
              type: 'movie',
              name: item.data.name || item.data.title || item.matched_title,
              coverUrl: item.data.cover_url || item.data.image || ''
            }));
          
          // 更新本地缓存
          wx.setStorageSync('movieList', updatedMovies);
          console.log('电影详情同步完成:', updatedMovies.length);
          
          // 重新加载数据
          this.loadTotalData();
        }
      },
      fail: (err) => {
        console.error('同步电影详情失败:', err);
      }
    });
  },

  // 同步剧集详细信息
  syncShowDetails(showList) {
    if (!showList || showList.length === 0) return;
    
    const showNames = showList.map(item => item.name || item.title).filter(name => name);
    if (showNames.length === 0) return;
    
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
        if (res.data.code === 0 && res.data.results && Array.isArray(res.data.results)) {
          const updatedShows = res.data.results
            .filter(item => item && item.data)
            .map(item => ({
              ...item.data,
              type: 'series',
              name: item.data.name || item.data.title || item.matched_title,
              coverUrl: item.data.cover_url || item.data.image || ''
            }));
          
          // 更新本地缓存
          wx.setStorageSync('showList', updatedShows);
          console.log('剧集详情同步完成:', updatedShows.length);
          
          // 重新加载数据
          this.loadTotalData();
        }
      },
      fail: (err) => {
        console.error('同步剧集详情失败:', err);
      }
    });
  },

  // 删除任意类型的项目
  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个项目吗？',
      success: (res) => {
        if (res.confirm) {
          // 标记数据已变更
          this.markDataChanged();
          
          // 删除全部列表中的项
          const newTotalList = this.data.totalList.filter(item => item.id !== id);
          this.setData({ totalList: newTotalList });
          
          // 删除对应分类列表中的项
          if (type === 'movie') {
            const movieList = wx.getStorageSync('movieList') || [];
            wx.setStorageSync('movieList', movieList.filter(item => item.id !== id));
          } else if (type === 'series') {
            const showList = wx.getStorageSync('showList') || [];
            wx.setStorageSync('showList', showList.filter(item => item.id !== id));
          }
          
          // 同步删除待看清单
          const alreadyList = wx.getStorageSync('alreadyList') || [];
          wx.setStorageSync('alreadyList', alreadyList.filter(item => item.id !== id));
          
          // 更新行数
          this.updateRowCount();
          
          wx.showToast({ title: '删除成功', icon: 'none' });
        }
      }
    });
  },

  // 批量删除
  batchDelete() {
    const { selectedElements, totalList } = this.data;
    
    if (selectedElements.length === 0) {
      wx.showToast({ title: '请先选择要删除的项目', icon: 'none' });
      return;
    }
    
    wx.showModal({
      title: '确认批量删除',
      content: `确定要删除选中的${selectedElements.length}个项目吗？`,
      success: (res) => {
        if (res.confirm) {
          // 标记数据已变更
          this.markDataChanged();
          
          // 获取要删除的项目类型
          const deletedItems = totalList.filter(item => selectedElements.includes(item.id));
          
          // 删除全部列表中的项
          const newTotalList = totalList.filter(item => !selectedElements.includes(item.id));
          this.setData({ 
            totalList: newTotalList,
            selectedElements: [] 
          });
          
          // 按类型删除对应列表中的项
          const movieIdsToDelete = deletedItems
            .filter(item => item.type === 'movie')
            .map(item => item.id);
          
          const seriesIdsToDelete = deletedItems
            .filter(item => item.type === 'series')
            .map(item => item.id);
          
          // 更新电影列表
          if (movieIdsToDelete.length > 0) {
            const movieList = wx.getStorageSync('movieList') || [];
            wx.setStorageSync('movieList', movieList.filter(item => !movieIdsToDelete.includes(item.id)));
          }
          
          // 更新剧集列表
          if (seriesIdsToDelete.length > 0) {
            const showList = wx.getStorageSync('showList') || [];
            wx.setStorageSync('showList', showList.filter(item => !seriesIdsToDelete.includes(item.id)));
          }
          
          // 同步删除待看清单
          const alreadyList = wx.getStorageSync('alreadyList') || [];
          wx.setStorageSync('alreadyList', alreadyList.filter(item => !selectedElements.includes(item.id)));
          
          // 更新行数
          this.updateRowCount();
          
          wx.showToast({ title: '批量删除成功', icon: 'none' });
        }
      }
    });
  },

  // 选择项目（用于批量操作）
  selectItem(e) {
    const id = e.currentTarget.dataset.id;
    const { selectedElements } = this.data;
    
    if (selectedElements.includes(id)) {
      // 取消选择
      this.setData({
        selectedElements: selectedElements.filter(itemId => itemId !== id)
      });
    } else {
      // 添加选择
      this.setData({
        selectedElements: [...selectedElements, id]
      });
    }
  },

  // 全选/取消全选
  toggleSelectAll() {
    const { totalList, selectedElements } = this.data;
    
    if (selectedElements.length === totalList.length) {
      // 取消全选
      this.setData({ selectedElements: [] });
    } else {
      // 全选
      this.setData({
        selectedElements: totalList.map(item => item.id)
      });
    }
  },

  // 清空全部数据
  clearAllData() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有影视数据吗？此操作不可恢复！',
      success: (res) => {
        if (res.confirm) {
          // 标记数据已变更
          this.markDataChanged();
          
          this.setData({ 
            totalList: [],
            selectedElements: [] 
          });
          
          // 清空所有相关存储
          wx.setStorageSync('totalMovieList', []);
          wx.setStorageSync('movieList', []);
          wx.setStorageSync('showList', []);
          wx.setStorageSync('reactionList', []);
          wx.setStorageSync('alreadyList', []);
          
          // 更新行数
          this.updateRowCount();
          
          wx.showToast({ title: '已清空全部数据', icon: 'none' });
        }
      }
    });
  },
  
  // 跳转到详情页
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    const type = e.currentTarget.dataset.type;
    const item = this.data.totalList.find(item => item.id === id);
    
    if (item) {
      const url = type === 'series' || type === '剧集' 
        ? `/pages/show/show?id=${id}` 
        : `/pages/movie/movie?id=${id}`;
        
      wx.navigateTo({ url });
    }
  },

  // 手动同步所有数据的详细信息
  syncAllDetails() {
    this.setData({ loading: true, syncStatus: '正在同步数据...' });
    
    // 分别同步电影和剧集详情
    const movieList = wx.getStorageSync('movieList') || [];
    const showList = wx.getStorageSync('showList') || [];
    
    this.syncMovieDetails(movieList);
    this.syncShowDetails(showList);
    
    this.setData({ syncStatus: '数据同步完成' });
    wx.showToast({ title: '数据同步完成', icon: 'success' });
    
    setTimeout(() => {
      this.setData({ syncStatus: '', loading: false });
    }, 2000);
  },
  // 跳转到添加页面
  goToAdd() {
    wx.showActionSheet({
      itemList: ['添加电影', '添加剧集', '添加综艺'],
      success: (res) => {
        switch(res.tapIndex) {
        case 0:
          wx.navigateTo({ url: '/pages/movie/movie' });
          break;
        case 1:
          wx.navigateTo({ url: '/pages/show/show' });
          break;
        case 2:
          wx.navigateTo({ url: '/pages/variety/variety' });
          break;
      }
    }
  });
}
});