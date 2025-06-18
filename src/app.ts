import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import session from "express-session";
import cookieParser from "cookie-parser";
import * as ConnectRedis from "connect-redis";
import redisClient from "./config/redis";
import { AppConfig } from "./config/AppConfig";
import routes from "./routes";

// Initialize Express app
const app = express();

// Apply security headers
app.use(helmet());

app.use(cors({
  origin: AppConfig.isProduction()
    ? process.env.FRONTEND_URL || "https://giraffe-space.vercel.app"
    : ["http://localhost:3001", "http://localhost:5173", "http://localhost:8080"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Parse incoming requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Configure Redis session store
app.use(session({
  secret: AppConfig.SESSION_SECRET || "default-secret-key",
  name: "session_id",
  store: new ConnectRedis.RedisStore({ client: redisClient }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: AppConfig.isProduction(),
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: "lax"
  }
}));

// Enable request logging in non-test environments
if (!AppConfig.isTest()) {
  app.use(morgan(AppConfig.LOG_FORMAT));
}

// API routes
app.use(AppConfig.API_PREFIX, routes);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({ status: "UP" });
});

// Error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error(`[Error] ${err.status || 500} - ${err.message || "Unknown error"}`);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Something went wrong",
    ...(AppConfig.isDevelopment() && { stack: err.stack })
  });
});

export default app;
