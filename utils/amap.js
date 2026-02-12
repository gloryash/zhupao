/**
 * 高德地图API封装
 * 使用高德地图微信小程序SDK
 * 文档：https://lbs.amap.com/api/wx/summary
 */

// 高德地图API Key（可选）
// 如果不配置Key，将使用简化的地址显示功能
// 如需详细地址，请在高德开放平台申请：https://console.amap.com/dev/key/app
const AMAP_KEY = ''; // 留空表示不使用高德地图API，使用简化模式

/**
 * 获取当前位置
 * @returns {Promise} 返回位置信息
 */
function getLocation() {
  return new Promise((resolve, reject) => {
    // 先检查用户是否授权位置权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          // 已授权，直接获取位置
          getLocationData(resolve, reject);
        } else {
          // 未授权，请求授权
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              // 授权成功，获取位置
              getLocationData(resolve, reject);
            },
            fail: () => {
              // 授权失败，提示用户
              wx.showModal({
                title: '需要位置权限',
                content: '为了匹配附近的志愿者，需要获取您的位置信息',
                confirmText: '去设置',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    // 打开设置页面
                    wx.openSetting({
                      success: (settingRes) => {
                        if (settingRes.authSetting['scope.userLocation']) {
                          getLocationData(resolve, reject);
                        } else {
                          reject(new Error('用户拒绝授权位置权限'));
                        }
                      }
                    });
                  } else {
                    reject(new Error('用户拒绝授权位置权限'));
                  }
                }
              });
            }
          });
        }
      }
    });
  });
}

/**
 * 获取位置数据的内部方法
 */
function getLocationData(resolve, reject) {
  wx.showLoading({
    title: '定位中...',
    mask: true
  });

  wx.getLocation({
    type: 'gcj02', // 返回高德坐标系
    success: (res) => {
      // 获取经纬度成功，调用高德API逆地理编码获取详细地址
      getAddressByLocation(res.latitude, res.longitude)
        .then((address) => {
          wx.hideLoading();
          resolve({
            latitude: res.latitude,
            longitude: res.longitude,
            address: address
          });
        })
        .catch((err) => {
          wx.hideLoading();
          // 即使获取地址失败，也返回经纬度
          resolve({
            latitude: res.latitude,
            longitude: res.longitude,
            address: '定位成功'
          });
        });
    },
    fail: (err) => {
      wx.hideLoading();
      wx.showToast({
        title: '定位失败，请检查定位权限',
        icon: 'none',
        duration: 2000
      });
      reject(err);
    }
  });
}

/**
 * 根据经纬度获取详细地址（逆地理编码）
 * @param {Number} latitude - 纬度
 * @param {Number} longitude - 经度
 * @returns {Promise} 返回地址字符串
 */
function getAddressByLocation(latitude, longitude) {
  return new Promise((resolve, reject) => {
    // 如果没有配置高德地图Key，使用简化的地址显示
    if (!AMAP_KEY || AMAP_KEY === '') {
      const simpleAddress = `位置: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      resolve(simpleAddress);
      return;
    }

    // 使用高德地图API获取详细地址
    wx.request({
      url: 'https://restapi.amap.com/v3/geocode/regeo',
      data: {
        key: AMAP_KEY,
        location: `${longitude},${latitude}`,
        extensions: 'base'
      },
      success: (res) => {
        if (res.data.status === '1' && res.data.regeocode) {
          const address = res.data.regeocode.formatted_address;
          resolve(address);
        } else {
          // API调用失败，返回简化地址
          const simpleAddress = `位置: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          resolve(simpleAddress);
        }
      },
      fail: (err) => {
        // 网络请求失败，返回简化地址
        const simpleAddress = `位置: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        resolve(simpleAddress);
      }
    });
  });
}

/**
 * 计算两点之间的距离（米）
 * @param {Number} lat1 - 第一个点的纬度
 * @param {Number} lng1 - 第一个点的经度
 * @param {Number} lat2 - 第二个点的纬度
 * @param {Number} lng2 - 第二个点的经度
 * @returns {Number} 距离（米）
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const radLat1 = lat1 * Math.PI / 180.0;
  const radLat2 = lat2 * Math.PI / 180.0;
  const a = radLat1 - radLat2;
  const b = lng1 * Math.PI / 180.0 - lng2 * Math.PI / 180.0;
  let distance = 2 * Math.asin(Math.sqrt(
    Math.pow(Math.sin(a / 2), 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.pow(Math.sin(b / 2), 2)
  ));
  distance = distance * 6378137.0; // 地球半径（米）
  distance = Math.round(distance * 10000) / 10000;
  return distance;
}

/**
 * 格式化距离显示
 * @param {Number} distance - 距离（米）
 * @returns {String} 格式化后的距离字符串
 */
function formatDistance(distance) {
  if (distance < 1000) {
    return Math.round(distance) + 'm';
  } else {
    return (distance / 1000).toFixed(1) + 'km';
  }
}

module.exports = {
  getLocation,
  getAddressByLocation,
  calculateDistance,
  formatDistance
};
