"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/app.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const express_session_1 = __importDefault(require("express-session"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
// --- CORRECTED IMPORTS AND USAGE FOR REDIS SESSION STORE ---
// For connect-redis v6+, you typically import the RedisStore class directly
const ConnectRedis = __importStar(require("connect-redis"));
// Import your configured Redis client from './config/redis'
const redis_1 = __importDefault(require("./config/redis"));
// ------------------------------------------
const AppConfig_1 = require("./config/AppConfig");
const routes_1 = __importDefault(require("./routes"));
// Initialize express app
const app = (0, express_1.default)();
// Apply standard Express middlewares
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        const allowedOrigins = [
            "http://localhost:3001",
            "http://localhost:3000",
            "https://venue-and-event-management-front-si.vercel.app/",
            AppConfig_1.AppConfig.CORS_ORIGIN, // fallback to env/config
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        }
        else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// --- CONFIGURE REDIS AS THE SESSION STORE ---
// The RedisStore class is now directly imported.
// Instantiate it, passing your redisClient directly to its constructor.
// express-session will automatically handle passing its 'session' object internally.
app.use((0, express_session_1.default)({
    secret: AppConfig_1.AppConfig.SESSION_SECRET ||
        "a-super-secret-key-that-should-be-in-env-variables",
    name: "my.sid",
    store: new ConnectRedis.RedisStore({ client: redis_1.default }), // <--- CORRECTED USAGE HERE
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: AppConfig_1.AppConfig.isProduction(),
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: "lax",
    },
}));
// ------------------------------------------
// Logging middleware
if (!AppConfig_1.AppConfig.isTest()) {
    app.use((0, morgan_1.default)(AppConfig_1.AppConfig.LOG_FORMAT));
}
// API routes
app.use(AppConfig_1.AppConfig.API_PREFIX, routes_1.default);
// Health check endpoint
app.get("/health", (req, res) => {
    res.status(200).json({ status: "UP" });
});
// Error handling middleware
app.use((err, req, res, next) => {
    const status = err.status || 500;
    const message = err.message || "Something went wrong";
    console.error(`[Error] ${status} - ${message}`);
    res.status(status).json(Object.assign({ status,
        message }, (AppConfig_1.AppConfig.isDevelopment() && { stack: err.stack })));
});
console.log("this cors origin from app.ts:", AppConfig_1.AppConfig.CORS_ORIGIN);
exports.default = app;
