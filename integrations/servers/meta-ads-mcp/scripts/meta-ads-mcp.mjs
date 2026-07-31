#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";
import {
  normalizeMetrics,
  normalizeNumericId,
  resolveDateRange,
  sanitizeMetaPayload,
  validateConfirmedMessage
} from "./meta-graph-utils.mjs";

const SERVER_NAME = "meta-ads-mcp";
const SERVER_VERSION = "0.2.0";
const PROTOCOL_VERSION = "2025-03-26";
const DEFAULT_ACCOUNT = process.env.META_AD_ACCOUNT_ID || "act_900524242288960";
const DEFAULT_INSTAGRAM_ACCOUNT =
  process.env.META_INSTAGRAM_ACCOUNT_ID || "17841471481136852";
const DEFAULT_PAGE_ID = process.env.META_PAGE_ID || "495341997002120";
const API_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";
const KEYCHAIN_SERVICE = process.env.META_KEYCHAIN_SERVICE || "codex.meta.ads";
const KEYCHAIN_ACCOUNT = process.env.META_KEYCHAIN_ACCOUNT || "access-token";
const GRAPH_ORIGIN = "https://graph.facebook.com";

const tools = [
  {
    name: "meta_connection_status",
    description: "Check whether a Meta access token is available without returning the token.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "meta_list_ad_accounts",
    description: "List Meta ad accounts accessible to the authorized user.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 200, default: 50 }
      },
      additionalProperties: false
    }
  },
  {
    name: "meta_get_account_insights",
    description: "Read account-level Meta Ads performance metrics for a preset or explicit date range.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string", description: "Defaults to the configured Haweiyi account." },
        date_preset: {
          type: "string",
          enum: ["today", "yesterday", "last_3d", "last_7d", "last_14d", "last_28d", "last_30d", "this_month", "last_month"],
          default: "last_7d"
        },
        since: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        until: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }
      },
      additionalProperties: false
    }
  },
  {
    name: "meta_list_campaigns",
    description: "List campaigns. Active delivery is the default scope.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string" },
        active_only: { type: "boolean", default: true },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 100 }
      },
      additionalProperties: false
    }
  },
  {
    name: "meta_list_adsets",
    description: "List ad sets. Active delivery is the default scope.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string" },
        active_only: { type: "boolean", default: true },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 100 }
      },
      additionalProperties: false
    }
  },
  {
    name: "meta_list_ads",
    description: "List ads with creative URL parameters when available. Active delivery is the default scope.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string" },
        active_only: { type: "boolean", default: true },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 100 }
      },
      additionalProperties: false
    }
  },
  {
    name: "meta_get_ad_insights",
    description: "Read ad-level delivery and performance metrics for a preset or explicit date range.",
    inputSchema: {
      type: "object",
      properties: {
        ad_account_id: { type: "string" },
        date_preset: {
          type: "string",
          enum: ["today", "yesterday", "last_3d", "last_7d", "last_14d", "last_28d", "last_30d", "this_month", "last_month"],
          default: "last_7d"
        },
        since: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        until: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        limit: { type: "integer", minimum: 1, maximum: 500, default: 200 }
      },
      additionalProperties: false
    }
  },
  {
    name: "instagram_connection_status",
    description:
      "Check the configured Instagram professional account, Page association, and required permissions without returning access tokens.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "instagram_get_profile",
    description:
      "Read the configured Instagram professional account profile and aggregate account counts.",
    inputSchema: {
      type: "object",
      properties: {
        instagram_account_id: {
          type: "string",
          pattern: "^\\d+$",
          description: "Defaults to the configured @southeastrippa account."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "instagram_get_insights",
    description:
      "Read account-level Instagram insights for a comma-separated metric list and explicit or default seven-day date range.",
    inputSchema: {
      type: "object",
      properties: {
        instagram_account_id: { type: "string", pattern: "^\\d+$" },
        metrics: {
          type: "string",
          description: "Comma-separated metric names. Defaults to reach."
        },
        period: {
          type: "string",
          enum: ["day", "week", "days_28", "lifetime"],
          default: "day"
        },
        metric_type: {
          type: "string",
          enum: ["total_value", "time_series"],
          default: "total_value"
        },
        since: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        until: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" }
      },
      additionalProperties: false
    }
  },
  {
    name: "instagram_list_media",
    description:
      "List recent Instagram posts, Reels, and supported media with public engagement fields.",
    inputSchema: {
      type: "object",
      properties: {
        instagram_account_id: { type: "string", pattern: "^\\d+$" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 25 }
      },
      additionalProperties: false
    }
  },
  {
    name: "instagram_get_media_insights",
    description:
      "Read supported Instagram insights for one media object. The default metric is reach.",
    inputSchema: {
      type: "object",
      required: ["media_id"],
      properties: {
        media_id: { type: "string", pattern: "^\\d+$" },
        metrics: {
          type: "string",
          description: "Comma-separated metric names. Defaults to reach."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "instagram_list_conversations",
    description:
      "List Instagram Direct conversations for the configured Facebook Page. This is a read-only operation.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: { type: "string", pattern: "^\\d+$" },
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 }
      },
      additionalProperties: false
    }
  },
  {
    name: "instagram_get_conversation_messages",
    description:
      "Read a bounded set of messages from one Instagram Direct conversation.",
    inputSchema: {
      type: "object",
      required: ["conversation_id"],
      properties: {
        conversation_id: { type: "string", pattern: "^\\d+$" },
        page_id: { type: "string", pattern: "^\\d+$" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 }
      },
      additionalProperties: false
    }
  },
  {
    name: "instagram_send_text_message",
    description:
      "Send one Instagram Direct text reply. This external action requires confirm_send=true on every call.",
    inputSchema: {
      type: "object",
      required: ["recipient_id", "message", "confirm_send"],
      properties: {
        recipient_id: { type: "string", pattern: "^\\d+$" },
        message: { type: "string", minLength: 1, maxLength: 1000 },
        confirm_send: { type: "boolean", const: true },
        page_id: { type: "string", pattern: "^\\d+$" }
      },
      additionalProperties: false
    }
  }
];

function getAccessToken() {
  const direct = process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN;
  if (direct) return direct.trim();

  try {
    return execFileSync(
      "/usr/bin/security",
      ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", KEYCHAIN_ACCOUNT, "-w"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
  } catch {
    return "";
  }
}

function normalizeAccountId(value) {
  const id = String(value || DEFAULT_ACCOUNT).trim();
  if (!/^act_\d+$/.test(id)) {
    throw new Error("ad_account_id must use the act_123456 format");
  }
  return id;
}

function dateParams(args) {
  if (args.since || args.until) {
    if (!args.since || !args.until) {
      throw new Error("since and until must be provided together");
    }
    return { time_range: JSON.stringify({ since: args.since, until: args.until }) };
  }
  return { date_preset: args.date_preset || "last_7d" };
}

async function graphRequest(
  path,
  { params = {}, method = "GET", body, token: tokenOverride, sanitize = true } = {}
) {
  const token = tokenOverride || getAccessToken();
  if (!token) {
    throw new Error(
      `Meta access token is unavailable. Store it in macOS Keychain service "${KEYCHAIN_SERVICE}" account "${KEYCHAIN_ACCOUNT}", or set META_ACCESS_TOKEN.`
    );
  }

  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  const url = new URL(`${GRAPH_ORIGIN}/${API_VERSION}/${normalizedPath}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = { Authorization: `Bearer ${token}` };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    const metaError = payload.error || {};
    const code = metaError.code ? ` code=${metaError.code}` : "";
    const subcode = metaError.error_subcode ? ` subcode=${metaError.error_subcode}` : "";
    throw new Error(`Meta Graph API request failed (${response.status}${code}${subcode}): ${metaError.message || "Unknown error"}`);
  }

  return sanitize ? sanitizeMetaPayload(payload) : payload;
}

async function graphGet(path, params = {}, token) {
  return graphRequest(path, { params, token });
}

async function getPageAccessToken(pageId) {
  const payload = await graphRequest(pageId, {
    params: { fields: "access_token" },
    sanitize: false
  });
  const pageToken = String(payload.access_token || "").trim();
  if (!pageToken) {
    throw new Error("Meta Graph API did not return a Page access token");
  }
  return pageToken;
}

function activeFilter(activeOnly) {
  return activeOnly === false ? undefined : JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]);
}

async function callTool(name, args = {}) {
  switch (name) {
    case "meta_connection_status": {
      const token = getAccessToken();
      return {
        configured: Boolean(token),
        token_source: process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN ? "environment" : token ? "macOS Keychain" : "none",
        graph_api_version: API_VERSION,
        default_ad_account_id: DEFAULT_ACCOUNT,
        mode: "read-only"
      };
    }
    case "meta_list_ad_accounts":
      return graphGet("me/adaccounts", {
        fields: "id,name,account_id,account_status,currency,timezone_name,business{id,name}",
        limit: args.limit || 50
      });
    case "meta_get_account_insights": {
      const account = normalizeAccountId(args.ad_account_id);
      return graphGet(`${account}/insights`, {
        fields: "account_id,account_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,cpc,cpm,ctr,actions,cost_per_action_type,date_start,date_stop",
        ...dateParams(args)
      });
    }
    case "meta_list_campaigns": {
      const account = normalizeAccountId(args.ad_account_id);
      return graphGet(`${account}/campaigns`, {
        fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time",
        filtering: activeFilter(args.active_only),
        limit: args.limit || 100
      });
    }
    case "meta_list_adsets": {
      const account = normalizeAccountId(args.ad_account_id);
      return graphGet(`${account}/adsets`, {
        fields: "id,name,campaign_id,status,effective_status,optimization_goal,billing_event,bid_strategy,daily_budget,lifetime_budget,start_time,end_time,created_time,updated_time",
        filtering: activeFilter(args.active_only),
        limit: args.limit || 100
      });
    }
    case "meta_list_ads": {
      const account = normalizeAccountId(args.ad_account_id);
      return graphGet(`${account}/ads`, {
        fields: "id,name,campaign_id,adset_id,status,effective_status,created_time,updated_time,creative{id,name,url_tags,object_story_spec}",
        filtering: activeFilter(args.active_only),
        limit: args.limit || 100
      });
    }
    case "meta_get_ad_insights": {
      const account = normalizeAccountId(args.ad_account_id);
      return graphGet(`${account}/insights`, {
        level: "ad",
        fields: "ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,cpc,cpm,ctr,actions,cost_per_action_type,date_start,date_stop",
        ...dateParams(args),
        limit: args.limit || 200
      });
    }
    case "instagram_connection_status": {
      const token = getAccessToken();
      if (!token) {
        return {
          configured: false,
          token_source: "none",
          graph_api_version: API_VERSION,
          instagram_account_id: DEFAULT_INSTAGRAM_ACCOUNT,
          page_id: DEFAULT_PAGE_ID
        };
      }

      const [debug, page] = await Promise.all([
        graphRequest("debug_token", {
          params: { input_token: token },
          token
        }),
        graphGet(DEFAULT_PAGE_ID, {
          fields: "id,name,instagram_business_account{id,username}"
        })
      ]);
      const scopes = debug.data?.scopes || [];
      const requiredScopes = [
        "instagram_basic",
        "instagram_manage_insights",
        "instagram_manage_messages",
        "pages_manage_metadata",
        "pages_read_engagement",
        "pages_show_list",
        "business_management"
      ];

      return {
        configured: true,
        token_source:
          process.env.META_ACCESS_TOKEN || process.env.FACEBOOK_ACCESS_TOKEN
            ? "environment"
            : "macOS Keychain",
        graph_api_version: API_VERSION,
        token_valid: debug.data?.is_valid === true,
        instagram_account: page.instagram_business_account || {
          id: DEFAULT_INSTAGRAM_ACCOUNT
        },
        page: { id: page.id, name: page.name },
        required_permissions: Object.fromEntries(
          requiredScopes.map((scope) => [scope, scopes.includes(scope)])
        ),
        mode: "read and explicitly confirmed messaging"
      };
    }
    case "instagram_get_profile": {
      const instagramAccount = normalizeNumericId(
        args.instagram_account_id || DEFAULT_INSTAGRAM_ACCOUNT,
        "instagram_account_id"
      );
      return graphGet(instagramAccount, {
        fields:
          "id,username,name,biography,website,followers_count,follows_count,media_count,profile_picture_url"
      });
    }
    case "instagram_get_insights": {
      const instagramAccount = normalizeNumericId(
        args.instagram_account_id || DEFAULT_INSTAGRAM_ACCOUNT,
        "instagram_account_id"
      );
      const metrics = normalizeMetrics(args.metrics, ["reach"]);
      return graphGet(`${instagramAccount}/insights`, {
        metric: metrics.join(","),
        period: args.period || "day",
        metric_type: args.metric_type || "total_value",
        ...resolveDateRange(args)
      });
    }
    case "instagram_list_media": {
      const instagramAccount = normalizeNumericId(
        args.instagram_account_id || DEFAULT_INSTAGRAM_ACCOUNT,
        "instagram_account_id"
      );
      const limit = Math.min(100, Math.max(1, Number(args.limit) || 25));
      return graphGet(`${instagramAccount}/media`, {
        fields:
          "id,caption,media_type,media_product_type,media_url,permalink,thumbnail_url,timestamp,username,like_count,comments_count",
        limit
      });
    }
    case "instagram_get_media_insights": {
      const mediaId = normalizeNumericId(args.media_id, "media_id");
      const metrics = normalizeMetrics(args.metrics, ["reach"]);
      return graphGet(`${mediaId}/insights`, {
        metric: metrics.join(",")
      });
    }
    case "instagram_list_conversations": {
      const pageId = normalizeNumericId(
        args.page_id || DEFAULT_PAGE_ID,
        "page_id"
      );
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
      const pageToken = await getPageAccessToken(pageId);
      return graphGet(
        `${pageId}/conversations`,
        {
          platform: "instagram",
          fields: "id,updated_time,participants",
          limit
        },
        pageToken
      );
    }
    case "instagram_get_conversation_messages": {
      const conversationId = normalizeNumericId(
        args.conversation_id,
        "conversation_id"
      );
      const pageId = normalizeNumericId(
        args.page_id || DEFAULT_PAGE_ID,
        "page_id"
      );
      const limit = Math.min(100, Math.max(1, Number(args.limit) || 50));
      const pageToken = await getPageAccessToken(pageId);
      return graphGet(
        `${conversationId}/messages`,
        {
          fields: "id,created_time,from,to,message,attachments",
          limit
        },
        pageToken
      );
    }
    case "instagram_send_text_message": {
      const { recipientId, message } = validateConfirmedMessage(args);
      const pageId = normalizeNumericId(
        args.page_id || DEFAULT_PAGE_ID,
        "page_id"
      );
      const pageToken = await getPageAccessToken(pageId);
      return graphRequest(`${pageId}/messages`, {
        method: "POST",
        body: {
          recipient: { id: recipientId },
          message: { text: message }
        },
        token: pageToken
      });
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function resultContent(value) {
  const sanitized = sanitizeMetaPayload(value);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(sanitized, null, 2)
      }
    ]
  };
}

async function handle(message) {
  if (!message || message.jsonrpc !== "2.0") return;

  if (message.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }
      }
    });
    return;
  }

  if (message.method === "notifications/initialized") return;

  if (message.method === "ping") {
    send({ jsonrpc: "2.0", id: message.id, result: {} });
    return;
  }

  if (message.method === "tools/list") {
    send({ jsonrpc: "2.0", id: message.id, result: { tools } });
    return;
  }

  if (message.method === "tools/call") {
    try {
      const output = await callTool(message.params?.name, message.params?.arguments || {});
      send({ jsonrpc: "2.0", id: message.id, result: resultContent(output) });
    } catch (error) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          isError: true,
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }]
        }
      });
    }
    return;
  }

  if (message.id !== undefined) {
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: { code: -32601, message: `Method not found: ${message.method}` }
    });
  }
}

const input = createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    await handle(JSON.parse(line));
  } catch (error) {
    send({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32700, message: error instanceof Error ? error.message : String(error) }
    });
  }
});
