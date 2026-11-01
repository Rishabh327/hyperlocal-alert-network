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
const User = require('./models/User');
const Photo = require('./models/Photo');
const jwt = require('jsonwebtoken');

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

// CLIENT_URL may hold several comma-separated origins,
// e.g. "https://my-app.vercel.app,http://localhost:5173"
const normalizeOrigin = (o) => o.trim().replace(/\/+$/, "");
const allowedOrigins = [
  ...(process.env.CLIENT_URL || "").split(",").map(normalizeOrigin).filter(Boolean),
  "http://localhost:5173",
];

const corsOptions = {
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(normalizeOrigin(origin))) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
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
    origin: corsOptions.origin,
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

  // Each user's sockets join a private room "user:<id>" so broadcasts reach
  // every open tab/device. Identify the user from the JWT sent in the handshake.
  const registerSocket = (userId) => {
    if (!userId) return;
    socket.userId = userId.toString();
    socket.join(`user:${socket.userId}`);
    console.log(`User registered: ${socket.userId} to socket: ${socket.id}`);
  };

  const handshakeToken = socket.handshake.auth && socket.handshake.auth.token;
  if (handshakeToken) {
    try {
      const decoded = jwt.verify(handshakeToken, process.env.JWT_SECRET);
      registerSocket(decoded.id);
    } catch (err) {
      console.log("Socket token verification failed:", err.message);
    }
  }

  socket.on("register_user", (userId) => {
    if (!socket.userId) registerSocket(userId);
  });

  socket.on("update_location", (data = {}) => {
    const { lat, lng } = data;
    const userId = socket.userId || data.userId;
    const latVal = parseFloat(lat);
    const lngVal = parseFloat(lng);
    if (!userId || Number.isNaN(latVal) || Number.isNaN(lngVal)) return;
    User.findByIdAndUpdate(userId, {
      lastLocation: {
        type: "Point",
        coordinates: [lngVal, latVal]
      }
    }).catch(err => console.log("Update location socket error:", err));
  });

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

// Serve photos stored in MongoDB (survives restarts on hosts with ephemeral disks)
// e.g., GET /photos/665f1c...
app.get('/photos/:id', async (req, res) => {
  try {
    const photo = await Photo.findById(req.params.id);
    if (!photo) return res.status(404).send('Photo not found');
    res.set('Content-Type', photo.contentType);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(photo.data);
  } catch (error) {
    res.status(404).send('Photo not found');
  }
});

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
