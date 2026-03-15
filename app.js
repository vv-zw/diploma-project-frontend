App({
  globalData: {
    backendUrl: 'http://localhost:5000',
    userInfo: null
  },

  onLaunch() {
    this.checkAndSyncData();
  },

  getBackendUrl() {
    return this.globalData.backendUrl || 'http://localhost:5000';
  },

  normalizeContentType(type, fallback = '') {
    const value = String(type || '').trim().toLowerCase();
    const typeMap = {
      movie: 'movie',
      series: 'series',
      show: 'series',
      tv: 'series',
      '电影': 'movie',
      '剧集': 'series',
      '电视剧': 'series'
    };
    return typeMap[value] || fallback || '';
  },

  normalizeGenres(item) {
    const rawGenres = item?.genres ?? item?.selectedElements ?? [];

    if (Array.isArray(rawGenres)) {
      return rawGenres.map((genre) => String(genre).trim()).filter(Boolean);
    }

    if (typeof rawGenres === 'string') {
      return rawGenres
        .split(/[,/|、，]/)
        .map((genre) => genre.trim())
        .filter(Boolean);
    }

    return [];
  },

  buildPreferenceItem(item, fallbackType = '') {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const id = String(item.id || '').trim();
    const title = String(item.title || item.name || '').trim();
    const contentType = this.normalizeContentType(
      item.content_type || item.contentType || item.type,
      fallbackType
    );

    if (!id || !title || !contentType) {
      return null;
    }

    return {
      id,
      title,
      name: title,
      genres: this.normalizeGenres(item),
      rating: Number(item.rating || item.score || 0) || 0,
      cover_url: item.cover_url || item.coverUrl || '',
      year: item.year || '',
      director: item.director || '',
      actors: item.actors || '',
      type: contentType,
      content_type: contentType
    };
  },

  dedupePreferences(list) {
    const uniqueMap = new Map();

    list.forEach((item) => {
      const normalized = this.buildPreferenceItem(item, item._fallbackType || '');
      if (!normalized) {
        return;
      }

      const key = `${normalized.content_type}:${normalized.id}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, normalized);
      }
    });

    return Array.from(uniqueMap.values());
  },

  collectPreferences() {
    const movieList = wx.getStorageSync('movieList') || [];
    const showList = wx.getStorageSync('showList') || [];
    const legacySeriesList = wx.getStorageSync('seriesList') || [];
    const alreadyList = wx.getStorageSync('alreadyList') || [];

    return this.dedupePreferences([
      ...movieList.map((item) => ({ ...item, _fallbackType: 'movie' })),
      ...showList.map((item) => ({ ...item, _fallbackType: 'series' })),
      ...legacySeriesList.map((item) => ({ ...item, _fallbackType: 'series' })),
      ...alreadyList
    ]);
  },

  checkAndSyncData() {
    const preferences = this.collectPreferences();
    if (!preferences.length) {
      return;
    }

    this.syncUserData({
      preferences,
      silent: true
    }).catch((error) => {
      console.error('启动同步失败:', error);
    });
  },

  syncUserData(options = {}) {
    const {
      preferences = this.collectPreferences(),
      silent = false,
      onSuccess,
      onFail
    } = options;

    return new Promise((resolve, reject) => {
      if (!preferences.length) {
        const error = new Error('no_valid_preferences');
        if (typeof onFail === 'function') {
          onFail(error);
        }
        reject(error);
        return;
      }

      wx.request({
        url: `${this.getBackendUrl()}/sync-user-data`,
        method: 'POST',
        data: { preferences },
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.data && res.data.code === 0) {
            if (typeof onSuccess === 'function') {
              onSuccess(res);
            }
            resolve(res);
            return;
          }

          const error = new Error((res.data && res.data.error) || 'sync_failed');
          if (!silent) {
            console.error('同步用户数据失败:', error.message);
          }
          if (typeof onFail === 'function') {
            onFail(error);
          }
          reject(error);
        },
        fail: (err) => {
          if (!silent) {
            console.error('同步用户数据请求失败:', err);
          }
          if (typeof onFail === 'function') {
            onFail(err);
          }
          reject(err);
        }
      });
    });
  },

  refreshRecommendations(contentType = '', options = {}) {
    const {
      silent = false,
      onSuccess,
      onFail
    } = options;

    const normalizedType = this.normalizeContentType(contentType, '');
    const payload = normalizedType ? { type: normalizedType } : {};

    return new Promise((resolve, reject) => {
      wx.request({
        url: `${this.getBackendUrl()}/refresh-recommendations`,
        method: 'POST',
        data: payload,
        header: {
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.data && res.data.code === 0) {
            if (typeof onSuccess === 'function') {
              onSuccess(res);
            }
            resolve(res);
            return;
          }

          const error = new Error((res.data && res.data.error) || 'refresh_failed');
          if (!silent) {
            console.error('刷新推荐失败:', error.message);
          }
          if (typeof onFail === 'function') {
            onFail(error);
          }
          reject(error);
        },
        fail: (err) => {
          if (!silent) {
            console.error('刷新推荐请求失败:', err);
          }
          if (typeof onFail === 'function') {
            onFail(err);
          }
          reject(err);
        }
      });
    });
  },

  pollRefreshJob(jobId, options = {}) {
    const {
      interval = 1500,
      timeout = 30000,
      onSuccess,
      onFail
    } = options;

    return new Promise((resolve, reject) => {
      if (!jobId) {
        const error = new Error('missing_job_id');
        if (typeof onFail === 'function') {
          onFail(error);
        }
        reject(error);
        return;
      }

      const startedAt = Date.now();
      const poll = () => {
        wx.request({
          url: `${this.getBackendUrl()}/refresh-status`,
          data: { job_id: jobId },
          success: (res) => {
            if (!res.data || res.data.code !== 0) {
              const error = new Error((res.data && res.data.error) || 'refresh_status_failed');
              if (typeof onFail === 'function') {
                onFail(error);
              }
              reject(error);
              return;
            }

            if (res.data.status === 'done') {
              if (typeof onSuccess === 'function') {
                onSuccess(res);
              }
              resolve(res);
              return;
            }

            if (res.data.status === 'failed') {
              const error = new Error(res.data.error || 'refresh_job_failed');
              if (typeof onFail === 'function') {
                onFail(error);
              }
              reject(error);
              return;
            }

            if (Date.now() - startedAt >= timeout) {
              const error = new Error('refresh_timeout');
              if (typeof onFail === 'function') {
                onFail(error);
              }
              reject(error);
              return;
            }

            setTimeout(poll, interval);
          },
          fail: (err) => {
            if (typeof onFail === 'function') {
              onFail(err);
            }
            reject(err);
          }
        });
      };

      poll();
    });
  },

  syncAndRefresh(contentType = '', options = {}) {
    const {
      silent = false,
      onSuccess,
      onFail
    } = options;
    const normalizedType = this.normalizeContentType(contentType, '');

    return this.syncUserData({
      silent
    }).then((syncRes) => {
      const syncData = syncRes.data || {};
      const jobId = normalizedType && syncData.jobs ? syncData.jobs[normalizedType] : '';

      if (jobId) {
        return this.pollRefreshJob(jobId).then((statusRes) => ({
          syncResult: syncRes,
          refreshResult: statusRes
        }));
      }

      return this.refreshRecommendations(normalizedType, { silent }).then((refreshRes) => {
        const refreshData = refreshRes.data || {};
        if (refreshData.status === 'done' || refreshData.reused) {
          return {
            syncResult: syncRes,
            refreshResult: refreshRes
          };
        }

        if (refreshData.job_id) {
          return this.pollRefreshJob(refreshData.job_id).then((statusRes) => ({
            syncResult: syncRes,
            refreshResult: statusRes
          }));
        }

        return {
          syncResult: syncRes,
          refreshResult: refreshRes
        };
      });
    }).then((result) => {
      if (typeof onSuccess === 'function') {
        onSuccess(result);
      }
      return result;
    }).catch((error) => {
      if (!silent) {
        console.error('同步并刷新失败:', error);
      }
      if (typeof onFail === 'function') {
        onFail(error);
      }
      throw error;
    });
  }
});
