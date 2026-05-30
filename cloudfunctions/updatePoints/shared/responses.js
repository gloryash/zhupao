function ok(data) {
  return { success: true, ...(data || {}) }
}

function fail(code, error, extra) {
  return { success: false, code, error, ...(extra || {}) }
}

module.exports = { ok, fail }
