const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config();

const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

// 🔥 Stable model fallback chain (IMPORTANT FIX)
const MODELS = ["mistral", "llama3.2", "phi"];

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// SYSTEM PROMPT
const SYSTEM_MESSAGE = {
  role: "system",
  content:
    "You are a helpful college helpdesk assistant for admissions, fees, exams, and campus support."
};

// MEMORY STORE
const chatHistories = new Map();

function getHistory(sessionId) {
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, [SYSTEM_MESSAGE]);
  }
  return chatHistories.get(sessionId);
}

// 🔥 SAFE OLLAMA CALL WITH FALLBACK MODELS
async function askOllama(messages) {
  for (const model of MODELS) {
    try {
      const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false
        })
      });

      if (!res.ok) {
        const text = await res.text();
        console.log(`❌ Model ${model} failed:`, text);
        continue; // try next model
      }

      const data = await res.json();
      console.log(`✅ Response from model: ${model}`);

      return data?.message?.content || "No response from AI";
    } catch (err) {
      console.log(`❌ Error with model ${model}:`, err.message);
    }
  }

  return "⚠️ All AI models failed. Please check Ollama or install a model.";
}

// ROUTES
app.get("/", (req, res) => {
  res.send("🚀 AI Help Desk Running");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    models: MODELS,
    uptime: process.uptime(),
    ollama: OLLAMA_HOST
  });
});

// CHAT API (REST)
app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId = "default" } = req.body;

    if (!message) {
      return res.status(400).json({ reply: "Message required" });
    }

    const history = getHistory(sessionId);

    history.push({ role: "user", content: message });

    const reply = await askOllama(history);

    history.push({ role: "assistant", content: reply });

    res.json({ reply, sessionId });
  } catch (err) {
    console.error("CHAT ERROR:", err.message);
    res.status(500).json({
      reply: "Server error while processing chat"
    });
  }
});

// SOCKET.IO CHAT
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("chat_message", async (msg) => {
    const history = getHistory(socket.id);

    history.push({ role: "user", content: msg });

    const reply = await askOllama(history);

    history.push({ role: "assistant", content: reply });

    socket.emit("bot_reply", reply);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// START SERVER
server.listen(PORT, () => {
  console.log(`🚀 Server running: http://localhost:${PORT}`);
  console.log(`🤖 Ollama Host: ${OLLAMA_HOST}`);
  console.log(`🧠 Models: ${MODELS.join(" → ")}`);
});