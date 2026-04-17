const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

// ───────────────── CONFIG ─────────────────
const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

// 🔥 Fallback models
const MODELS = ["mistral", "llama3.2", "phi"];

// ───────────────── APP SETUP ─────────────────
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ───────────────── SYSTEM PROMPT ─────────────────
const SYSTEM_MESSAGE = `
You are EduDesk AI, a helpful assistant for Shri Ramswaroop Memorial University (SRMU), Lucknow.

Answer ONLY using the provided data when possible.
If not found, give general guidance.

Keep answers:
- Short (max 120 words)
- Clear
- Use bullet/numbered lists when needed
- End with a helpful follow-up question
`;

// ───────────────── LOAD TXT DATA ─────────────────
let knowledge = "";

function loadKnowledge() {
  try {
    knowledge = fs.readFileSync("./data/college.txt", "utf-8");
    console.log("✅ Knowledge loaded successfully");
  } catch (err) {
    console.log("❌ Error loading knowledge:", err.message);
  }
}

// ───────────────── MEMORY ─────────────────
const chatHistories = new Map();

function getHistory(sessionId) {
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, []);
  }
  return chatHistories.get(sessionId);
}

// ───────────────── OLLAMA CALL ─────────────────
async function askOllama(messages) {
  for (const model of MODELS) {
    try {
      const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model,
          messages,
          stream: false
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.log(`❌ ${model} failed:`, text);
        continue;
      }

      const data = await res.json();
      console.log(`✅ Using model: ${model}`);

      return data?.message?.content || "No response from AI";
    } catch (err) {
      console.log(`❌ Error with ${model}:`, err.message);
    }
  }

  return "⚠️ All AI models failed. Please check Ollama.";
}

// ───────────────── ROUTES ─────────────────
app.get("/", (req, res) => {
  res.send("🚀 EduDesk AI Running");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    models: MODELS,
    uptime: process.uptime(),
    knowledgeLoaded: !!knowledge
  });
});

// ───────────────── CHAT API ─────────────────
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message required" });
    }

    const history = getHistory(sessionId);

    // Build full context
    const messages = [
      {
        role: "system",
        content: SYSTEM_MESSAGE + "\n\nDATA:\n" + knowledge
      },
      ...history,
      { role: "user", content: message }
    ];

    const reply = await askOllama(messages);

    // Save memory
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: reply });

    res.json({ reply, sessionId });
  } catch (err) {
    console.error("CHAT ERROR:", err.message);
    res.status(500).json({
      reply: "Server error while processing chat"
    });
  }
});

// ───────────────── SOCKET.IO ─────────────────
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("chat_message", async (msg) => {
    const history = getHistory(socket.id);

    const messages = [
      {
        role: "system",
        content: SYSTEM_MESSAGE + "\n\nDATA:\n" + knowledge
      },
      ...history,
      { role: "user", content: msg }
    ];

    const reply = await askOllama(messages);

    history.push({ role: "user", content: msg });
    history.push({ role: "assistant", content: reply });

    socket.emit("bot_reply", reply);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// ───────────────── START SERVER ─────────────────
loadKnowledge();

server.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
  console.log(`🤖 Ollama: ${OLLAMA_HOST}`);
  console.log(`🧠 Models: ${MODELS.join(" → ")}`);
});