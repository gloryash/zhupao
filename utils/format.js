const ORDER_STATUS_LABEL = {
  waiting: '等待接单',
  accepted: '已接单',
  arrived: '已到达',
  running: '陪跑中',
  completed: '已完成',
  cancelled: '已取消'
};

const APPOINTMENT_STATUS_LABEL = {
  pending: '待确认',
  confirmed: '已确认',
  completed: '已完成',
  cancelled: '已取消'
};

function statusTone(status) {
  if (status === 'running' || status === 'confirmed') return 'pine';
  if (status === 'cancelled') return 'coral';
  if (status === 'waiting' || status === 'pending') return 'sky';
  if (status === 'accepted' || status === 'arrived') return 'accent';
  return '';
}

function formatDistance(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${trimNumber(n)} km`;
}

function formatMeters(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n < 1000) return `${Math.round(n)} m`;
  return `${(n / 1000).toFixed(1)} km`;
}

function formatMinutes(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${Math.round(n)} 分钟`;
}

function formatDuration(minutes) {
  const n = Math.round(Number(minutes) || 0);
  if (n <= 0) return '—';
  if (n < 60) return `${n} 分`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m ? `${h} 时 ${m} 分` : `${h} 时`;
}

function trimNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

function expProgress(exp = 0) {
  const n = Math.max(0, Number(exp) || 0);
  const into = n % 100;
  return { pct: into, toNext: 100 - into, level: Math.floor(n / 100) + 1 };
}

function tierBadge(level) {
  return `Lv.${level || 1}`;
}

function isActiveOrder(status) {
  return status !== 'completed' && status !== 'cancelled';
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startAddress(order) {
  order = order || {};
  return (order.origin && order.origin.address) || order.originAddress || order.address || '';
}

function destinationAddress(order) {
  order = order || {};
  return (order.destination && order.destination.address) || order.destinationAddress || '';
}

function orderStart(order) {
  order = order || {};
  const lat = order.origin && order.origin.latitude !== undefined ? order.origin.latitude : (order.originLatitude !== undefined ? order.originLatitude : order.latitude);
  const lng = order.origin && order.origin.longitude !== undefined ? order.origin.longitude : (order.originLongitude !== undefined ? order.originLongitude : order.longitude);
  return point(lat, lng);
}

function orderDestination(order) {
  order = order || {};
  const lat = order.destination && order.destination.latitude !== undefined ? order.destination.latitude : order.destinationLatitude;
  const lng = order.destination && order.destination.longitude !== undefined ? order.destination.longitude : order.destinationLongitude;
  return point(lat, lng);
}

function orderVolunteerPoint(order) {
  order = order || {};
  return point(order.volunteerLat, order.volunteerLng);
}

function point(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude === 0 && longitude === 0) return null;
  return { latitude, longitude };
}

function decorateOrder(order, role) {
  const start = startAddress(order);
  const dest = destinationAddress(order);
  return {
    ...order,
    statusLabel: ORDER_STATUS_LABEL[order.status] || order.status || '未知',
    statusTone: statusTone(order.status),
    startAddress: start || '未填写起点',
    destinationAddress: dest,
    targetDistanceText: formatDistance(order.targetDistance),
    durationText: formatMinutes(order.estimatedDuration),
    actualDistanceText: formatDistance(order.actualDistance),
    actualDurationText: formatMinutes(order.duration),
    distanceText: formatMeters(order.distance),
    partyLabel: role === 'volunteer' ? '跑者' : '陪跑志愿者',
    partyName: role === 'volunteer'
      ? (order.runnerName || order.blindName || order.userName || order.userNickName || '视障跑者')
      : (order.volunteerName || order.volunteerNickName || '等待志愿者')
  };
}

function decorateAppointment(appointment, role) {
  return {
    ...appointment,
    statusLabel: APPOINTMENT_STATUS_LABEL[appointment.status] || appointment.status || '未知',
    statusTone: statusTone(appointment.status),
    distanceText: appointment.targetDistance ? formatDistance(appointment.targetDistance) : '',
    durationText: appointment.estimatedDuration ? formatMinutes(appointment.estimatedDuration) : '',
    partyLabel: role === 'volunteer' ? '跑者' : '陪跑志愿者',
    partyName: role === 'volunteer' ? (appointment.blindName || '视障跑者') : (appointment.volunteerName || '志愿者')
  };
}

module.exports = {
  ORDER_STATUS_LABEL,
  APPOINTMENT_STATUS_LABEL,
  statusTone,
  formatDistance,
  formatMeters,
  formatMinutes,
  formatDuration,
  expProgress,
  tierBadge,
  isActiveOrder,
  todayISO,
  startAddress,
  destinationAddress,
  orderStart,
  orderDestination,
  orderVolunteerPoint,
  decorateOrder,
  decorateAppointment
};
