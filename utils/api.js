const session = require('./session');

const AUTH_ERROR_CODES = ['SESSION_EXPIRED', 'AUTH_REQUIRED', 'USER_NOT_FOUND'];

class CloudError extends Error {
  constructor(message, code, response) {
    super(message || '操作失败，请稍后再试');
    this.name = 'CloudError';
    this.code = code || 'CLOUD_ERROR';
    this.response = response;
  }
}

function callFunction(name, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name,
      data,
      success(res) {
        resolve(res.result || {});
      },
      fail(err) {
        reject(new CloudError(err.errMsg || '云函数调用失败', 'NETWORK_ERROR', err));
      }
    });
  });
}

async function request(fn, action, payload = {}, opts = {}) {
  const data = { action, ...payload };
  if (!opts.anonymous) {
    const authToken = session.getToken();
    if (authToken) data.authToken = authToken;
  }

  const res = await callFunction(fn, data);
  if (!res || res.success !== true) {
    const code = (res && res.code) || 'CLOUD_ERROR';
    const message = (res && (res.error || res.message)) || '操作失败，请稍后再试';
    if (!opts.anonymous && AUTH_ERROR_CODES.indexOf(code) >= 0) {
      session.clearSession();
      wx.reLaunch({ url: '/pages/login/login' });
    }
    throw new CloudError(message, code, res);
  }
  return res;
}

async function registerAccount(identifier, password, profile) {
  const res = await request('webAuth', 'register', { identifier, password, profile }, { anonymous: true });
  return { authToken: res.authToken, expiresAt: res.expiresAt, user: res.user };
}

async function loginAccount(identifier, password) {
  const res = await request('webAuth', 'login', { identifier, password }, { anonymous: true });
  return { authToken: res.authToken, expiresAt: res.expiresAt, user: res.user };
}

async function fetchMe(token) {
  const res = await request('webAuth', 'me', { authToken: token }, { anonymous: true });
  return res.user;
}

async function logoutAccount(token) {
  if (!token) return;
  await callFunction('webAuth', { action: 'logout', authToken: token });
}

async function getUserProfile() {
  const res = await request('handleUser', 'getUserProfile');
  return res.user;
}

async function getUserStats() {
  const res = await request('handleUser', 'getUserStats');
  return res.stats;
}

async function updateProfile(payload) {
  const res = await request('handleUser', 'updateProfile', payload);
  return res.user;
}

async function updateEmergencyContact(payload) {
  const res = await request('handleUser', 'updateEmergencyContact', payload);
  return res.emergencyContact || {};
}

async function updateUserLocation(latitude, longitude) {
  await request('handleUser', 'updateLocation', { latitude, longitude });
}

async function getTrainingStatus() {
  const res = await request('handleTraining', 'getTrainingStatus');
  return res.status;
}

async function markVideoWatched() {
  await request('handleTraining', 'updateVideoWatched');
}

async function getExamQuestions() {
  const res = await request('handleTraining', 'getExamQuestions', {}, { anonymous: true });
  return { questions: res.questions || [], passScore: res.passScore || 80 };
}

async function submitExam(answers) {
  return request('handleTraining', 'submitExam', { answers });
}

async function getCertificate() {
  try {
    const res = await request('handleTraining', 'getCertificate');
    return res.certificate || null;
  } catch (err) {
    if (err instanceof CloudError) return null;
    throw err;
  }
}

async function verifyCertificate(certificateNo) {
  const res = await request('handleTraining', 'verifyCertificate', { certificateNo }, { anonymous: true });
  return { valid: !!res.valid, certificate: res.certificate };
}

async function getVolunteers(page = 1, pageSize = 20) {
  const res = await request('handleVolunteer', 'getVolunteers', { page, pageSize }, { anonymous: true });
  return res.volunteers || [];
}

async function getAvailableVolunteers(latitude, longitude, radius = 50000) {
  const res = await request('handleVolunteer', 'getAvailableVolunteers', { latitude, longitude, radius });
  return res.volunteers || [];
}

async function updateAvailability(isAvailable, latitude, longitude) {
  await request('handleVolunteer', 'updateAvailability', { isAvailable, latitude, longitude });
}

async function publishOrder(input) {
  const origin = input.origin || {};
  const destination = input.destination || {};
  const city = input.city || origin.city || destination.city || '';
  const res = await request('handleOrder', 'publish', {
    targetDistance: input.targetDistance,
    estimatedDuration: input.estimatedDuration,
    runTimeWindow: input.runTimeWindow || 'immediate',
    departureMode: input.departureMode || 'immediate',
    departureOffsetMinutes: input.departureOffsetMinutes || 0,
    departureAt: input.departureAt || '',
    departureLabel: input.departureLabel || '',
    city,
    origin: { ...origin, city: origin.city || city },
    destination: { ...destination, city: destination.city || city },
    latitude: origin.latitude,
    longitude: origin.longitude,
    address: origin.address,
    destinationLatitude: destination.latitude,
    destinationLongitude: destination.longitude,
    destinationAddress: destination.address
  });
  return res.order;
}

async function getWaitingOrders(filters = {}) {
  const payload = {
    maxDistance: filters.maxDistance || 20000,
    distanceBasis: filters.distanceBasis || 'origin',
    gender: filters.gender || 'all',
    ageRange: filters.ageRange || 'all',
    city: filters.city || 'all',
    timeWindow: filters.timeWindow || 'all',
    departureFilterType: filters.departureFilterType || 'all'
  };
  ['latitude', 'longitude', 'departureWithinMinutes', 'departureHour', 'departureDate'].forEach((key) => {
    if (filters[key] !== undefined && filters[key] !== '') payload[key] = filters[key];
  });
  const res = await request('handleOrder', 'getWaitingOrders', payload);
  return res.orders || [];
}

async function getMyOrders(status) {
  const res = await request('handleOrder', 'getMyOrders', status ? { status } : {});
  return res.orders || [];
}

async function getOrderDetail(orderId) {
  try {
    const res = await request('handleOrder', 'getOrderDetail', orderId ? { orderId } : {});
    return res.order || null;
  } catch (err) {
    if (err instanceof CloudError && err.code === 'ORDER_NOT_FOUND') return null;
    throw err;
  }
}

async function acceptOrder(orderId, coords) {
  const payload = { orderId };
  if (coords) {
    payload.latitude = coords.latitude;
    payload.longitude = coords.longitude;
  }
  const res = await request('handleOrder', 'accept', payload);
  return res.order;
}

async function updateOrderStatus(orderId, status) {
  await request('handleOrder', 'updateOrderStatus', { orderId, status });
}

async function updateVolunteerLocation(payload) {
  await request('handleOrder', 'updateVolunteerLocation', payload);
}

async function completeOrder(orderId, actualDistance, duration) {
  await request('handleOrder', 'complete', { orderId, actualDistance, duration });
}

async function cancelOrder(orderId) {
  await request('handleOrder', 'cancel', { orderId });
}

async function getAppointments(status) {
  const res = await request('handleSchedule', 'getAppointments', status ? { status } : {});
  return res.appointments || [];
}

async function createAppointment(payload) {
  const res = await request('handleSchedule', 'createAppointment', payload);
  return res.appointment;
}

async function confirmAppointment(appointmentId) {
  await request('handleSchedule', 'confirmAppointment', { appointmentId });
}

async function completeAppointment(appointmentId, rating, comment) {
  await request('handleSchedule', 'completeAppointment', { appointmentId, rating, comment });
}

async function cancelAppointment(appointmentId) {
  await request('handleSchedule', 'cancelAppointment', { appointmentId });
}

async function searchAddress(query, city) {
  const res = await request('handleGeo', 'search', { query, city, limit: 8 }, { anonymous: true });
  return res.results || [];
}

async function reverseGeocode(latitude, longitude) {
  const res = await request('handleGeo', 'reverse', { latitude, longitude }, { anonymous: true });
  return res.address || {};
}

module.exports = {
  CloudError,
  callFunction,
  request,
  registerAccount,
  loginAccount,
  fetchMe,
  logoutAccount,
  getUserProfile,
  getUserStats,
  updateProfile,
  updateEmergencyContact,
  updateUserLocation,
  getTrainingStatus,
  markVideoWatched,
  getExamQuestions,
  submitExam,
  getCertificate,
  verifyCertificate,
  getVolunteers,
  getAvailableVolunteers,
  updateAvailability,
  publishOrder,
  getWaitingOrders,
  getMyOrders,
  getOrderDetail,
  acceptOrder,
  updateOrderStatus,
  updateVolunteerLocation,
  completeOrder,
  cancelOrder,
  getAppointments,
  createAppointment,
  confirmAppointment,
  completeAppointment,
  cancelAppointment,
  searchAddress,
  reverseGeocode
};
