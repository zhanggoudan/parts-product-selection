const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const METRIC_PATTERN = /^[a-z][a-z0-9_]*$/;

export function sanitizeMetaPayload(value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetaPayload(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.toLowerCase() !== "access_token")
      .map(([key, item]) => [key, sanitizeMetaPayload(item)])
  );
}

export function normalizeNumericId(value, fieldName = "id") {
  const normalized = String(value ?? "").trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${fieldName} must be a numeric Meta identifier`);
  }
  return normalized;
}

export function normalizeMetrics(value, fallback = ["reach"]) {
  const source =
    value === undefined || value === null || value === ""
      ? fallback
      : Array.isArray(value)
        ? value
        : String(value).split(",");

  const normalized = [...new Set(source.map((metric) => String(metric).trim()).filter(Boolean))];
  if (!normalized.length || normalized.some((metric) => !METRIC_PATTERN.test(metric))) {
    throw new Error("Each metric must use lowercase letters, digits, and underscores");
  }
  return normalized;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function resolveDateRange(args = {}, now = new Date()) {
  if (args.since || args.until) {
    if (!args.since || !args.until) {
      throw new Error("since and until must be provided together");
    }
    if (!DATE_PATTERN.test(args.since) || !DATE_PATTERN.test(args.until)) {
      throw new Error("since and until must use YYYY-MM-DD");
    }
    if (args.since > args.until) {
      throw new Error("since must be on or before until");
    }
    return { since: args.since, until: args.until };
  }

  const until = new Date(now);
  const since = new Date(now);
  since.setUTCDate(since.getUTCDate() - 7);
  return { since: formatDate(since), until: formatDate(until) };
}

export function validateConfirmedMessage(args = {}) {
  if (args.confirm_send !== true) {
    throw new Error("confirm_send must be true before sending an Instagram message");
  }

  const recipientId = normalizeNumericId(args.recipient_id, "recipient_id");
  const message = String(args.message ?? "").trim();
  if (!message || message.length > 1000) {
    throw new Error("message must contain between 1 and 1000 characters");
  }

  return { recipientId, message };
}
