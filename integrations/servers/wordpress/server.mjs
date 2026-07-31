#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createInterface } from "node:readline";

const SERVER_NAME = "southeastrippa-wordpress";
const SERVER_VERSION = "0.3.0";
const PROTOCOL_VERSION = "2025-03-26";
const SITE_URL = process.env.SOUTHEASTRIPPA_WORDPRESS_SITE_URL || "https://www.southeastrippa.us";
const USERNAME = process.env.SOUTHEASTRIPPA_WORDPRESS_USERNAME || "codex_mcp";
const KEYCHAIN_SERVICE = process.env.SOUTHEASTRIPPA_WORDPRESS_KEYCHAIN_SERVICE || "codex.southeastrippa.wordpress";
const KEYCHAIN_ACCOUNT = process.env.SOUTHEASTRIPPA_WORDPRESS_KEYCHAIN_ACCOUNT || USERNAME;
const RS06_PRODUCT_ID = Number(process.env.SOUTHEASTRIPPA_RS06_PRODUCT_ID || 162);

const tools = [
  {
    name: "wordpress_connection_status",
    description:
      "Verify the SoutheastRippa WordPress REST connection and report the dedicated MCP account without exposing credentials.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "wordpress_list_products",
    description:
      "Read a bounded list of WooCommerce products. This tool does not modify products.",
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", maxLength: 100 },
        status: {
          type: "string",
          enum: ["any", "draft", "pending", "private", "publish"]
        },
        page: { type: "integer", minimum: 1, default: 1 },
        per_page: { type: "integer", minimum: 1, maximum: 100, default: 20 }
      },
      additionalProperties: false
    }
  },
  {
    name: "wordpress_create_product",
    description:
      "Create a WooCommerce product. New products default to draft unless status is explicitly supplied. This tool requires explicit write confirmation.",
    inputSchema: {
      type: "object",
      required: ["product", "confirm_write"],
      properties: {
        product: {
          type: "object",
          minProperties: 1,
          description:
            "WooCommerce product fields. A non-empty name is required. Supports content, status, type, price, SKU, inventory, shipping, categories, tags, images, attributes, related products, and metadata.",
          additionalProperties: true
        },
        confirm_write: {
          type: "boolean",
          const: true,
          description:
            "Must be true to confirm product creation."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "wordpress_get_product",
    description:
      "Read one WooCommerce product by numeric product ID. This tool does not modify products.",
    inputSchema: {
      type: "object",
      required: ["product_id"],
      properties: {
        product_id: { type: "integer", minimum: 1 }
      },
      additionalProperties: false
    }
  },
  {
    name: "wordpress_update_product",
    description:
      "Update any existing WooCommerce product by numeric product ID, including products added in the future. Product deletion and WordPress/plugin/theme updates are not supported.",
    inputSchema: {
      type: "object",
      required: ["product_id", "changes", "confirm_write"],
      properties: {
        product_id: { type: "integer", minimum: 1 },
        changes: {
          type: "object",
          minProperties: 1,
          description:
            "WooCommerce product fields to update. Supported fields include content, status, type, price, SKU, inventory, shipping, categories, tags, images, attributes, related products, and metadata.",
          additionalProperties: true
        },
        confirm_write: {
          type: "boolean",
          const: true,
          description:
            "Must be true to confirm the product write."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "wordpress_delete_product",
    description:
      "Delete a WooCommerce product. By default the product is moved to Trash and remains recoverable. Permanent deletion requires force=true and confirm_permanent_delete equal to the exact product ID.",
    inputSchema: {
      type: "object",
      required: ["product_id", "confirm_delete"],
      properties: {
        product_id: { type: "integer", minimum: 1 },
        confirm_delete: {
          type: "boolean",
          const: true,
          description:
            "Must be true for any product deletion."
        },
        force: {
          type: "boolean",
          default: false,
          description:
            "False moves the product to Trash. True permanently deletes it."
        },
        confirm_permanent_delete: {
          type: "integer",
          minimum: 1,
          description:
            "Required only for permanent deletion and must exactly equal product_id."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "wordpress_get_rs06_product",
    description:
      "Read the RS06 WooCommerce product only (product ID 162). This tool does not modify it.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "wordpress_update_rs06_quote_link",
    description:
      "Update only the external URL and button text of RS06 product ID 162. It cannot update other products, prices, themes, plugins, ads, or WordPress core.",
    inputSchema: {
      type: "object",
      required: ["external_url", "button_text", "confirm_write"],
      properties: {
        external_url: {
          type: "string",
          format: "uri",
          description:
            "Must be an HTTPS URL on www.southeastrippa.us."
        },
        button_text: {
          type: "string",
          minLength: 1,
          maxLength: 80
        },
        confirm_write: {
          type: "boolean",
          const: true,
          description:
            "Must be true to confirm this RS06 product write."
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "wordpress_test_write_access",
    description:
      "Verify authenticated write access by creating, reading, and permanently deleting one temporary draft post. It does not change public content.",
    inputSchema: {
      type: "object",
      required: ["confirm_write"],
      properties: {
        confirm_write: {
          type: "boolean",
          const: true,
          description:
            "Must be true to permit the temporary self-cleaning write test."
        }
      },
      additionalProperties: false
    }
  }
];

function getApplicationPassword() {
  const direct = process.env.SOUTHEASTRIPPA_WORDPRESS_APP_PASSWORD;
  if (direct) return direct.replace(/\s+/g, "");

  try {
    return execFileSync(
      "/usr/bin/security",
      [
        "find-generic-password",
        "-s",
        KEYCHAIN_SERVICE,
        "-a",
        KEYCHAIN_ACCOUNT,
        "-w"
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      }
    )
      .trim()
      .replace(/\s+/g, "");
  } catch {
    return "";
  }
}

function basicAuthHeader() {
  const password = getApplicationPassword();
  if (!password) {
    throw new Error(
      `WordPress Application Password is unavailable in macOS Keychain service "${KEYCHAIN_SERVICE}" account "${KEYCHAIN_ACCOUNT}".`
    );
  }
  return `Basic ${Buffer.from(`${USERNAME}:${password}`).toString("base64")}`;
}

async function wordpressRequest(path, { method = "GET", body } = {}) {
  const url = new URL(path, SITE_URL);
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: basicAuthHeader(),
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const code = payload?.code ? ` code=${payload.code}` : "";
    const message =
      typeof payload?.message === "string"
        ? payload.message.replace(/<[^>]*>/g, "")
        : "Unknown WordPress REST API error";
    throw new Error(
      `WordPress REST API request failed (${response.status}${code}): ${message}`
    );
  }

  return { status: response.status, payload };
}

function normalizePositiveInteger(value, name) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return number;
}

function summarizeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    status: product.status,
    type: product.type,
    sku: product.sku,
    permalink: product.permalink,
    external_url: product.external_url,
    button_text: product.button_text,
    price: product.price,
    regular_price: product.regular_price,
    stock_status: product.stock_status,
    date_modified_gmt: product.date_modified_gmt
  };
}

const ALLOWED_PRODUCT_UPDATE_FIELDS = new Set([
  "name",
  "slug",
  "type",
  "status",
  "featured",
  "catalog_visibility",
  "description",
  "short_description",
  "sku",
  "regular_price",
  "sale_price",
  "date_on_sale_from",
  "date_on_sale_to",
  "virtual",
  "downloadable",
  "downloads",
  "download_limit",
  "download_expiry",
  "external_url",
  "button_text",
  "tax_status",
  "tax_class",
  "manage_stock",
  "stock_quantity",
  "stock_status",
  "backorders",
  "sold_individually",
  "weight",
  "dimensions",
  "shipping_class",
  "reviews_allowed",
  "upsell_ids",
  "cross_sell_ids",
  "parent_id",
  "purchase_note",
  "categories",
  "tags",
  "images",
  "attributes",
  "default_attributes",
  "grouped_products",
  "menu_order",
  "meta_data"
]);

function validateProductChanges(args) {
  if (args.confirm_write !== true) {
    throw new Error("confirm_write must be true for a product write");
  }

  const changes = args.changes;
  if (
    !changes ||
    typeof changes !== "object" ||
    Array.isArray(changes) ||
    Object.keys(changes).length === 0
  ) {
    throw new Error("changes must contain at least one product field");
  }

  const unsupported = Object.keys(changes).filter(
    (field) => !ALLOWED_PRODUCT_UPDATE_FIELDS.has(field)
  );
  if (unsupported.length) {
    throw new Error(
      `Unsupported product update field(s): ${unsupported.join(", ")}`
    );
  }

  if (changes.external_url !== undefined) {
    let externalUrl;
    try {
      externalUrl = new URL(String(changes.external_url));
    } catch {
      throw new Error("external_url must be a valid URL");
    }
    if (externalUrl.protocol !== "https:") {
      throw new Error("external_url must use HTTPS");
    }
  }

  return changes;
}

function validateProductCreate(args) {
  if (args.confirm_write !== true) {
    throw new Error("confirm_write must be true for product creation");
  }

  const product = validateProductChanges({
    changes: args.product,
    confirm_write: true
  });
  const name = String(product.name || "").trim();
  if (!name) {
    throw new Error("product.name is required");
  }

  return {
    status: "draft",
    ...product,
    name
  };
}

function validateProductDelete(args) {
  const productId = normalizePositiveInteger(
    args.product_id,
    "product_id"
  );
  if (args.confirm_delete !== true) {
    throw new Error("confirm_delete must be true for product deletion");
  }

  const force = args.force === true;
  if (
    force &&
    Number(args.confirm_permanent_delete) !== productId
  ) {
    throw new Error(
      "confirm_permanent_delete must exactly equal product_id for permanent deletion"
    );
  }

  return { productId, force };
}

function validateRs06Write(args) {
  if (args.confirm_write !== true) {
    throw new Error("confirm_write must be true for an RS06 product write");
  }

  let url;
  try {
    url = new URL(String(args.external_url || ""));
  } catch {
    throw new Error("external_url must be a valid URL");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname.toLowerCase() !== "www.southeastrippa.us"
  ) {
    throw new Error(
      "external_url must use HTTPS on www.southeastrippa.us"
    );
  }

  const buttonText = String(args.button_text || "").trim();
  if (!buttonText || buttonText.length > 80) {
    throw new Error("button_text must contain 1 to 80 characters");
  }

  return { external_url: url.toString(), button_text: buttonText };
}

async function callTool(name, args) {
  switch (name) {
    case "wordpress_connection_status": {
      const { payload } = await wordpressRequest(
        "/wp-json/wp/v2/users/me?context=edit"
      );
      return {
        connected: true,
        site: "SoutheastRippa",
        site_url: SITE_URL,
        user_id: payload.id,
        username: payload.username,
        roles: payload.roles
      };
    }

    case "wordpress_list_products": {
      const page = Math.max(1, Number(args.page) || 1);
      const perPage = Math.min(
        100,
        Math.max(1, Number(args.per_page) || 20)
      );
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage)
      });
      if (args.search) params.set("search", String(args.search).slice(0, 100));
      if (args.status) params.set("status", String(args.status));

      const { payload } = await wordpressRequest(
        `/wp-json/wc/v3/products?${params.toString()}`
      );
      return {
        page,
        per_page: perPage,
        products: payload.map(summarizeProduct)
      };
    }

    case "wordpress_create_product": {
      const product = validateProductCreate(args);
      const { payload } = await wordpressRequest(
        "/wp-json/wc/v3/products",
        { method: "POST", body: product }
      );
      return {
        created: true,
        product: summarizeProduct(payload)
      };
    }

    case "wordpress_get_product": {
      const productId = normalizePositiveInteger(
        args.product_id,
        "product_id"
      );
      const { payload } = await wordpressRequest(
        `/wp-json/wc/v3/products/${productId}`
      );
      return summarizeProduct(payload);
    }

    case "wordpress_update_product": {
      const productId = normalizePositiveInteger(
        args.product_id,
        "product_id"
      );
      const changes = validateProductChanges(args);
      const { payload } = await wordpressRequest(
        `/wp-json/wc/v3/products/${productId}`,
        { method: "PUT", body: changes }
      );
      return {
        updated: true,
        product: summarizeProduct(payload),
        scope: {
          product_id: productId,
          changed_fields: Object.keys(changes)
        }
      };
    }

    case "wordpress_delete_product": {
      const { productId, force } = validateProductDelete(args);
      const params = new URLSearchParams({
        force: force ? "true" : "false"
      });
      const { payload } = await wordpressRequest(
        `/wp-json/wc/v3/products/${productId}?${params.toString()}`,
        { method: "DELETE" }
      );
      const product = summarizeProduct(payload.previous || payload);
      if (!force) product.status = "trash";
      return {
        deleted: true,
        permanently_deleted: force,
        product_id: productId,
        product
      };
    }

    case "wordpress_get_rs06_product": {
      const { payload } = await wordpressRequest(
        `/wp-json/wc/v3/products/${RS06_PRODUCT_ID}`
      );
      return summarizeProduct(payload);
    }

    case "wordpress_update_rs06_quote_link": {
      const update = validateRs06Write(args);
      const { payload } = await wordpressRequest(
        `/wp-json/wc/v3/products/${RS06_PRODUCT_ID}`,
        { method: "PUT", body: update }
      );
      return {
        updated: true,
        product: summarizeProduct(payload),
        scope: {
          product_id: RS06_PRODUCT_ID,
          changed_fields: ["external_url", "button_text"]
        }
      };
    }

    case "wordpress_test_write_access": {
      if (args.confirm_write !== true) {
        throw new Error(
          "confirm_write must be true for the temporary write test"
        );
      }

      let temporaryId = null;
      try {
        const created = await wordpressRequest("/wp-json/wp/v2/posts", {
          method: "POST",
          body: {
            title: "MCP API connection test - temporary",
            status: "draft",
            content:
              "Temporary object created only to verify authenticated REST write access."
          }
        });
        temporaryId = created.payload.id;

        const readBack = await wordpressRequest(
          `/wp-json/wp/v2/posts/${temporaryId}?context=edit`
        );
        const removed = await wordpressRequest(
          `/wp-json/wp/v2/posts/${temporaryId}?force=true`,
          { method: "DELETE" }
        );
        temporaryId = null;

        return {
          write_access: true,
          create_status: created.status,
          read_status: readBack.status,
          cleanup_status: removed.status,
          temporary_post_deleted: removed.payload.deleted === true
        };
      } finally {
        if (temporaryId) {
          await wordpressRequest(
            `/wp-json/wp/v2/posts/${temporaryId}?force=true`,
            { method: "DELETE" }
          ).catch(() => {});
        }
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function resultContent(value) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(value, null, 2)
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
      const output = await callTool(
        message.params?.name,
        message.params?.arguments || {}
      );
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: resultContent(output)
      });
    } catch (error) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          isError: true,
          content: [
            {
              type: "text",
              text: error instanceof Error ? error.message : String(error)
            }
          ]
        }
      });
    }
    return;
  }

  if (message.id !== undefined) {
    send({
      jsonrpc: "2.0",
      id: message.id,
      error: {
        code: -32601,
        message: `Method not found: ${message.method}`
      }
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
      error: {
        code: -32700,
        message: error instanceof Error ? error.message : String(error)
      }
    });
  }
});
