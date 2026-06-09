import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_SYSTEM_PROMPT = fs.readFileSync(
  path.join(__dirname, "../directives/system_prompt.md"),
  "utf8"
);

const PRODUCTS_RE = /\[PRODUCTS\]([\s\S]*?)\[\/PRODUCTS\]/;
const CHECKOUT_RE = /\[CHECKOUT_URL\](https?:\/\/[^\s]+)\[\/CHECKOUT_URL\]/;

function buildSystemPrompt(userProfile, recipientProfile) {
  let profile = "";

  if (userProfile?.name) {
    profile += `USER PROFILE\nName: ${userProfile.name}`;
    if (userProfile.age) profile += ` | Age: ${userProfile.age}`;
    if (userProfile.gender) profile += ` | Gender: ${userProfile.gender}`;
    profile += "\n";
  }

  if (recipientProfile?.relationship) {
    profile += `RECIPIENT PROFILE\nRelationship: ${recipientProfile.relationship}`;
    if (recipientProfile.age) profile += ` | Age: ${recipientProfile.age}`;
    if (recipientProfile.gender) profile += ` | Gender: ${recipientProfile.gender}`;
    profile += "\n";
  }

  return profile
    ? `${profile}\n---\n\n${BASE_SYSTEM_PROMPT}`
    : BASE_SYSTEM_PROMPT;
}

function parseResponse(rawText) {
  let message = rawText;
  let products = [];
  let checkoutUrl = null;

  const productsMatch = rawText.match(PRODUCTS_RE);
  if (productsMatch) {
    try {
      const parsed = JSON.parse(productsMatch[1].trim());
      products = parsed.items || parsed.products || [];
    } catch (_) {
      // malformed block — ignore, show raw text
    }
    message = message.replace(PRODUCTS_RE, "").trim();
  }

  const checkoutMatch = rawText.match(CHECKOUT_RE);
  if (checkoutMatch) {
    checkoutUrl = checkoutMatch[1];
    message = message.replace(CHECKOUT_RE, "").trim();
  }

  return { message, products, checkoutUrl };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { messages, userProfile, recipientProfile } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: buildSystemPrompt(userProfile, recipientProfile),
      messages,
      mcp_servers: [
        {
          type: "url",
          name: "kapruka",
          url: "https://mcp.kapruka.com/mcp",
        },
      ],
      betas: ["mcp-client-2025-11-20"],
    });

    const rawText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("");

    const { message, products, checkoutUrl } = parseResponse(rawText);

    res.status(200).json({ message, products, checkoutUrl });
  } catch (err) {
    console.error("Anthropic API error:", err);
    const status = err.status || 500;
    res.status(status).json({ error: err.message || "Internal server error" });
  }
}
