// ==============================================
// Server Entry Point — Hyperlocal Alert Network API
// ==============================================
// This is the main entry point for the backend server.
// It loads environment variables, connects to MongoDB,
// configures middleware (CORS, JSON parsing), sets up
// Socket.IO for real-time communication, serves uploaded
// files as static assets, mounts all routes, and starts
// listening on the configured port.

// Load environment variables from .env file FIRST
// This must be called before any other code that uses process.env
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/db');

// Import route files
const authRoutes = require('./routes/auth');
const alertRoutes = require('./routes/alerts');
const authorityRoutes = require('./routes/authority');

// ==============================================
// Connect to MongoDB
// ==============================================
// Establishes the database connection before the server starts
// accepting requests. If the connection fails, the process exits.
connectDB();

// ==============================================
// Initialize Express App & HTTP Server
// ==============================================
const app = express();

// Create an HTTP server from the Express app
// This is required for Socket.IO to work alongside Express
const server = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
  "http://localhost:5173",
  "https://your-app.vercel.app"
];

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
};

// ==============================================
// Socket.IO Setup — Real-Time Communication
// ==============================================
// Initialize Socket.IO on the HTTP server with CORS
// configured to allow connections from the Vite frontend
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Store the io instance on the app so route handlers can access it
// Controllers use req.app.get('io') to emit events
app.set('io', io);

// Handle Socket.IO connections
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ==============================================
// Middleware Configuration
// ==============================================

// Enable CORS — allows the frontend to make API requests to this backend
app.use(cors(corsOptions));

// Parse incoming JSON request bodies
// This allows us to access req.body in route handlers
app.use(express.json());

// Parse URL-encoded form data (needed for multer multipart forms)
app.use(express.urlencoded({ extended: true }));

// ==============================================
// Ensure uploads directory exists
// ==============================================
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files as static assets at /uploads
// e.g., GET /uploads/alert-abc123.jpg
app.use('/uploads', express.static(uploadsDir));

// ==============================================
// Mount Routes
// ==============================================

// All authentication routes are prefixed with /api/auth
// e.g., POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
app.use('/api/auth', authRoutes);

// All alert routes are prefixed with /api/alerts
// e.g., POST /api/alerts, GET /api/alerts/nearby, POST /api/alerts/:id/corroborate
app.use('/api/alerts', alertRoutes);

// All authority routes are prefixed with /api/authority
app.use('/api/authority', authorityRoutes);

// ==============================================
// Root Route — Health Check
// ==============================================
// A simple endpoint to verify the API is running
app.get('/', (req, res) => {
  res.json({
    message: 'Hyperlocal Alert Network API is running',
    version: '2.0.0',
  });
});

// ==============================================
// Start the Server
// ==============================================
// Use server.listen instead of app.listen so Socket.IO
// can share the same HTTP server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
