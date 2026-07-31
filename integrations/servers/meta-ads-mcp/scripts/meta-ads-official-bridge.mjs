#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";

const REMOTE_URL = process.env.META_ADS_MCP_URL || "https://mcp.facebook.com/ads";
const KEYCHAIN_SERVICE = process.env.META_KEYCHAIN_SERVICE || "codex.meta.ads";
const KEYCHAIN_ACCOUNT = process.env.META_KEYCHAIN_ACCOUNT || "access-token";

let sessionId = "";
let protocolVersion = "2025-03-26";

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

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function parseRemoteMessages(body, contentType) {
  if (!body.trim()) return [];

  if (contentType.includes("text/event-stream")) {
    return body
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean)
      .map((value) => JSON.parse(value));
  }

  return [JSON.parse(body)];
}

async function forward(message) {
  const token = getAccessToken();
  if (!token) {
    if (message.id !== undefined) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32001,
          message: `Meta access token is unavailable in macOS Keychain service "${KEYCHAIN_SERVICE}" account "${KEYCHAIN_ACCOUNT}".`
        }
      });
    }
    return;
  }

  if (message.method === "initialize" && message.params?.protocolVersion) {
    protocolVersion = message.params.protocolVersion;
  }

  const headers = {
    Accept: "application/json, text/event-stream",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "MCP-Protocol-Version": protocolVersion
  };
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const response = await fetch(REMOTE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(message)
  });

  const nextSessionId = response.headers.get("mcp-session-id");
  if (nextSessionId) sessionId = nextSessionId;

  const body = await response.text();
  if (!response.ok) {
    if (message.id !== undefined) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32002,
          message: `Meta Ads MCP request failed with HTTP ${response.status}.`
        }
      });
    }
    return;
  }

  for (const remoteMessage of parseRemoteMessages(body, response.headers.get("content-type") || "")) {
    send(remoteMessage);
  }
}

const input = createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
  terminal: false
});

let pending = Promise.resolve();

input.on("line", (line) => {
  if (!line.trim()) return;

  let message;
  try {
    message = JSON.parse(line);
  } catch {
    return;
  }

  pending = pending.then(async () => {
    try {
      await forward(message);
    } catch (error) {
      if (message.id !== undefined) {
        send({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32603,
            message: error instanceof Error ? error.message : "Meta Ads MCP bridge failed."
          }
        });
      }
    }
  });
});
