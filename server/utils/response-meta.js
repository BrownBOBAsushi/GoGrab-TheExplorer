function cleanReason(reason) {
  if (!reason) {
    return null;
  }

  return String(reason).trim() || null;
}

function createResponseMeta({ source = 'fallback', fallback = false, reason = null } = {}) {
  return {
    source,
    fallback: Boolean(fallback),
    reason: cleanReason(reason)
  };
}

function withResponseMeta(payload, meta) {
  return {
    ...payload,
    ...createResponseMeta(meta)
  };
}

module.exports = {
  createResponseMeta,
  withResponseMeta
};
