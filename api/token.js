import fs from "fs/promises";
import { instructions as rawInstructions } from "../constants/prompt.js";

const knowledgeBase = await fs.readFile(
  new URL("../data/knowledgebase.txt", import.meta.url),
  "utf-8",
);
const instructions = rawInstructions.replace("{{KNOWLEDGE_BASE}}", knowledgeBase);

const alfalahKnowledgeBase = await fs.readFile(
  new URL("../data/alfalah_knowledge_base.json", import.meta.url),
  "utf-8",
);
const avatar3Instructions = `${instructions}\n\n## KNOWLEDGE BASE\n${alfalahKnowledgeBase}`;

const BEHAVIOR_RULES = `

BEHAVIOR RULES:
- Greet the user warmly as soon as the session starts.
- Match the user's detected language on every turn. If the user speaks Urdu or Roman Urdu, reply only in Urdu or Roman Urdu. If the user speaks English, reply only in English.
- If the user sends abusive, offensive, threatening, or completely off-topic messages, call the flag_abuse function silently.
- After the flag_abuse tool result is returned, give one brief polite warning. If the tool result says the session will end, make it a final warning and say the session is ending now.
- At the end of a completed conversation, ask: "Is there anything else I can help you with?"
- If the user says they do not need anything else anymore, call the end_call function silently immediately. This includes phrases such as "I don't need anything", "I don't need anything else", "that's all", "I'm good", or "no thank you".
- If the user says a farewell or closing phrase (for example: "Allah Hafiz", "Khuda Hafiz", "bye", "goodbye", "see you", or "take care"), call the end_call function silently immediately.
- If the user combines both ideas in one utterance, such as "I don't need anything, Allah Hafiz", call the end_call function silently immediately.
- After the end_call tool result is returned, thank the user warmly and give a short goodbye. Do not mention tools or function calls.
- If the user asks three irrelevant or off-topic questions in a row, then call the end_call function silently, and after the tool result is returned, say "It seems like you might not need help right now. Feel free to reach out whenever you need assistance. Allah Hafiz!"
- Use common English loanwords naturally instead of translating every word into formal Urdu.
Prefer the words people actually use in banking, apps, and customer support conversations.
Examples:
“flexible” instead of “lachakdaar”
“report” instead of “report ki tafseel”
“mobile app” instead of “mobile darkhwast”
“update” instead of “taza karein”
“feature” instead of “khususiyaat”
Sound like a modern Pakistani banking assistant, not a textbook translator
`;

const sessionTools = [
  {
    type: "function",
    name: "flag_abuse",
    description:
      "Call this silently when the user sends abusive, offensive, threatening, or completely off-topic messages.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "end_call",
    description:
      "Call this silently when the user confirms they do not need further help anymore, when they say goodbye, or when they say a combined closing like I do not need anything Allah Hafiz.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

function buildSessionConfig({ voice, avatar }) {
  const baseInstructions = avatar === "avatar3" ? avatar3Instructions : instructions;

  return {
    session: {
      type: "realtime",
      model: "gpt-4o-mini-realtime-preview",
      audio: {
        input: {
          noise_reduction: {
            type: "near_field",
          },
          turn_detection: {
            type: "server_vad",
            threshold: 0.7,
            prefix_padding_ms: 300,
            silence_duration_ms: 700,
            create_response: true,
            interrupt_response: true,
          },
        },
        output: {
          voice,
        },
      },
      instructions: `${baseInstructions}${BEHAVIOR_RULES}`,
      tools: sessionTools,
      tool_choice: "auto",
    },
  };
}

export default async function handler(req, res) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("Missing OPENAI_API_KEY in Vercel environment.");
      return res.status(500).json({
        error: "Server is missing OPENAI_API_KEY.",
      });
    }

    const voice = req.query.voice || "marin";
    const avatar = req.query.avatar || "avatar1";

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildSessionConfig({ voice, avatar })),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI client_secrets error:", data);
      return res.status(response.status).json({
        error: data.error?.message || "Failed to generate token",
      });
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Token generation error:", error);
    return res.status(500).json({ error: "Failed to generate token" });
  }
}
