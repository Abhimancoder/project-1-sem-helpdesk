# EduDesk AI - Automated Help Desk System for Educational Institutions

A comprehensive AI-powered help desk solution designed specifically for schools, colleges, and universities. This system provides 24/7 automated support for student queries, intelligent ticket management, and seamless integration with educational workflows.

## Features

- 🤖 **AI Chatbot**: Conversational AI that understands natural language and provides instant answers
- 🕐 **24/7 Support**: Round-the-clock assistance for students, staff, and administrators
- 🎫 **Smart Ticket Management**: Automatic classification, prioritization, and routing of complex issues
- 🌐 **Multi-Language Support**: Support for 12+ languages including regional Indian languages
- 🔗 **System Integration**: Connects with ERP, LMS, and student management systems
- 📊 **Analytics Dashboard**: Comprehensive reporting on query volumes and resolution rates

## Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-helpdesk-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `.env.example` to `.env`
   - Add your OpenAI API key: `OPENAI_API_KEY=your_key_here`

4. **Start the server**
   ```bash
   npm start
   ```

5. **Open your browser**
   - Navigate to `http://lnocalhost:3000`
   - Click the chat button (💬) to interact with the AI assistant

## Project Structure

```
ai-helpdesk-system/
├── server.js              # Main server file with Express, Socket.IO, and OpenAI integration
├── public/
│   └── index.html         # Main website with embedded chat widget
├── package.json           # Node.js dependencies and scripts
├── .env                   # Environment variables (API keys)
└── README.md             # This file
```

## API Endpoints

- `GET /` - Serves the main website
- `POST /chat` - AI chat endpoint for processing messages
- `WebSocket /socket.io` - Real-time chat communication

## Technologies Used

- **Backend**: Node.js, Express.js
- **Real-time Communication**: Socket.IO
- **AI**: OpenAI GPT-4o-mini
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Deployment**: Ready for deployment on any Node.js hosting platform

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000  # Optional, defaults to 3000
```

### Customization

The AI assistant is pre-configured for educational institutions. To customize the behavior:

1. Modify the `SYSTEM` prompt in `public/index.html` (client-side)
2. Update the system message in `server.js` for server-side consistency

## Support

For questions or support:
- Email: hello@edudeskai.in
- Phone: +91 98765 43210
- Office: Sector 62, Noida, Uttar Pradesh 201309

## License

© 2025 EduDesk AI. All rights reserved.

---

Made with ♥ for Indian education.