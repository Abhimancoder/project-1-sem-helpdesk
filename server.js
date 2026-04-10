const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
require("dotenv").config();

const PORT = process.env.PORT || 3000;
const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3";

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
  content: "You are a helpful college helpdesk assistant for admissions, fees, exams, and campus support."
};

// MEMORY
const chatHistories = new Map();

function getHistory(sessionId) {
  if (!chatHistories.has(sessionId)) {
    chatHistories.set(sessionId, [SYSTEM_MESSAGE]);
  }
  return chatHistories.get(sessionId);
}

// CALL OLLAMA
async function askOllama(messages) {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false
      })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text);
    }

    const data = await res.json();
    return data?.message?.content || "No response from AI";
  } catch (err) {
    console.error("Ollama Error:", err.message);
    return "AI service not running. Start Ollama first.";
  }
}

// ROUTES
app.get("/", (req, res) => {
  res.send("🚀 AI Help Desk Running");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    model: OLLAMA_MODEL,
    uptime: process.uptime(),
    ollama: OLLAMA_HOST
  });
});

// CHAT API
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
    res.status(500).json({ reply: "Server error" });
  }
});

// SOCKET
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
  console.log(`🤖 Model: ${OLLAMA_MODEL}`);
  console.log(`🌍 Ollama: ${OLLAMA_HOST}`);
});