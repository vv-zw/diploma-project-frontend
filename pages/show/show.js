// pages/show/show.js
Page({
  data: {
    showList: [], // 存储剧集数据
    selectedElements: [], // 存储选中的剧集ID
    loading: true,
    syncStatus: "", // 同步状态提示（如"同步中..."）
    recommendList: [] // 实时存储推荐结果
  },

  onLoad() {
    // 页面加载时同时加载剧集列表和推荐
    Promise.all([this.loadShowData(), this.loadRecommendations()])
     .then(() => {
        this.setData({ loading: false });
      });
  },

  onShow() {
    // 页面显示时检查是否有更新（如从添加页返回）
    this.loadShowData().then(() => {
      this.loadRecommendations();
    });
  },

  // 1. 加载剧集数据并自动同步
  loadShowData() {
    return new Promise((resolve) => {
      this.setData({ loading: true });
      
      // 从本地缓存加载
      let showData = wx.getStorageSync('showList') || [];
      // 确保数据格式正确
      showData = showData.map(item => ({
       ...item,
        selectedElements: item.selectedElements || []
      }));
      
      this.setData({ showList: showData });
      
      // 同步到后端（带状态反馈）
      if (showData.length > 0) {
        this.setData({ syncStatus: "同步中..." });
        this.syncToBackend().then(() => {
          this.setData({ syncStatus: "" });
          resolve();
        }).catch(() => {
          this.setData({ syncStatus: "同步失败，点击重试" });
          resolve();
        });
      } else {
        this.setData({ loading: false });
        resolve();
      }
    });
  },

  // 2. 实时同步到后端（核心优化）
  syncToBackend() {
    return new Promise((resolve, reject) => {
      const { showList } = this.data;
      
      // 格式化需要同步的数据（仅包含必要字段）
      const preferences = showList.map(show => ({
        id: show.id,
        name: show.name,
        genres: show.selectedElements, // 标签数组（如["剧情", "悬疑"]）
        rating: show.rating || 0,
        cover_url: show.coverUrl || ""
      }));

      wx.request({
        url: 'https://blue-groups-tan.loca.lt/sync-user-data', // 后端同步接口
        method: 'POST',
        data: { preferences },
        timeout: 10000, // 延长超时时间，确保同步完成
        success: (res) => {
          if (res.data.code === 0) {
            console.log("同步成功，新标签权重：", res.data.count_weights);
            resolve(res.data); // 同步成功后返回结果
          } else {
            console.error("同步失败：", res.data.error);
            reject(res.data.error);
          }
        },
        fail: (err) => {
          console.error("网络错误：", err);
          reject("网络异常，同步失败");
        }
      });
    });
  },

  // 3. 加载最新推荐（同步后立即调用）
  loadRecommendations() {
    return new Promise((resolve) => {
      this.setData({ loading: true });
      
      wx.request({
        url: 'https://blue-groups-tan.loca.lt/get_recommend',
        method: 'GET',
        data: { type: 'series' }, // 注意：这里请求的是剧集推荐
        success: (res) => {
          if (res.data.code === 0) {
            this.setData({
              recommendList: res.data.data,
              loading: false
            });
          }
          resolve();
        },
        fail: () => {
          this.setData({ loading: false });
          resolve();
        }
      });
    });
  },

  // 4. 添加新剧集（优化：添加后立即同步+更新推荐）
  addShow() {
    wx.navigateTo({
      url: '/pages/addSeries/addSeries', // 假设添加剧集的页面路径
      // 返回当前页时立即刷新
      events: {
        onShowAdded: () => {
          this.loadShowData().then(() => {
            this.loadRecommendations();
          });
        }
      }
    });
  },

  // 5. 删除剧集（优化：删除后立即同步+更新推荐）
  deleteShow(e) {
    const id = e.currentTarget.dataset.id;
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这部剧集吗？',
      success: (res) => {
        if (res.confirm) {
          // 本地删除
          const newShowList = this.data.showList.filter(item => item.id !== id);
          this.setData({ showList: newShowList });
          wx.setStorageSync('showList', newShowList);
          
          // 同步删除总列表中的数据
          const totalList = wx.getStorageSync('totalMovieList') || [];
          const newTotalList = totalList.filter(item => item.id !== id);
          wx.setStorageSync('totalMovieList', newTotalList);
          
          // 立即同步并更新推荐
          this.setData({ syncStatus: "删除后同步中..." });
          this.syncToBackend()
           .then(() => {
              this.loadRecommendations(); // 同步成功后立即拉取新推荐
              this.setData({ syncStatus: "" });
              wx.showToast({ title: '删除并同步成功', icon: 'none' });
            })
           .catch((err) => {
              this.setData({ syncStatus: "同步失败：" + err });
            });
        }
      }
    });
  },

  // 6. 批量删除（同样优化实时同步）
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
          // 本地删除
          const newShowList = showList.filter(item => !selectedElements.includes(item.id));
          this.setData({ 
            showList: newShowList,
            selectedElements: [] 
          });
          wx.setStorageSync('showList', newShowList);
          
          // 同步删除总列表中的选中数据
          const totalList = wx.getStorageSync('totalMovieList') || [];
          const newTotalList = totalList.filter(item => !selectedElements.includes(item.id));
          wx.setStorageSync('totalMovieList', newTotalList);
          
          // 立即同步并更新推荐
          this.setData({ syncStatus: "批量删除后同步中..." });
          this.syncToBackend()
           .then(() => {
              this.loadRecommendations();
              this.setData({ syncStatus: "" });
              wx.showToast({ title: '批量删除并同步成功', icon: 'none' });
            })
           .catch((err) => {
              this.setData({ syncStatus: "同步失败：" + err });
            });
        }
      }
    });
  },

  // 7. 手动触发同步（用于同步失败时重试）
  retrySync() {
    this.setData({ syncStatus: "重试同步中..." });
    this.syncToBackend()
     .then(() => {
        this.loadRecommendations();
        this.setData({ syncStatus: "" });
        wx.showToast({ title: '同步成功', icon: 'none' });
      })
     .catch((err) => {
        this.setData({ syncStatus: "同步失败：" + err });
      });
  },

  // 多选框状态变化
  checkboxChange(e) {
    // 更新选中的剧集ID列表
    this.setData({
      selectedElements: e.detail.value
    });
  },

  // 跳转到剧集推荐详情页
  goToRecommendDetail() {
    wx.navigateTo({
      url: '/pages/seriesRecommend/seriesRecommend', // 假设剧集推荐页路径
      success: (res) => {
        // 传递当前推荐数据，避免重复请求
        res.eventChannel.emit('sendRecommendData', {
          recommendList: this.data.recommendList
        });
      }
    });
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadShowData();
    wx.stopPullDownRefresh();
  },

  // 其他生命周期函数
  onReady() {},
  onHide() {},
  onUnload() {},
  onReachBottom() {},
  onShareAppMessage() {}
});
