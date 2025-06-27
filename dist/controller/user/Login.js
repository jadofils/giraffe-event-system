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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginController = void 0;
const Database_1 = require("../../config/Database");
const User_1 = require("../../models/User");
const bcrypt = __importStar(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const EmailService_1 = __importDefault(require("../../services/emails/EmailService"));
const CacheService_1 = require("../../services/CacheService");
const SECRET_KEY = process.env.JWT_SECRET || "sdbgvkghdfcnmfxdxdfggj";
const COOKIE_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL = 3600; // 1 hour, consistent with VenueBookingRepository
class LoginController {
    /**
     * Login using default or user password
     * @route POST /api/auth/login/default
     * @access Public
     */
    static loginWithDefaultPassword(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!Database_1.AppDataSource.isInitialized) {
                res.status(500).json({ success: false, message: "Database not initialized" });
                return;
            }
            const { identifier, password } = req.body;
            if (!identifier || !password) {
                res.status(400).json({ success: false, message: "Please enter both identifier and password." });
                return;
            }
            const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
            try {
                const user = yield userRepository.findOne({
                    where: [
                        { email: identifier },
                        { username: identifier },
                        { phoneNumber: identifier }
                    ],
                    relations: ["role", "role.permissions", "organizations"],
                });
                if (!user) {
                    res.status(404).json({ success: false, message: "No account found with that email, username, or phone number." });
                    return;
                }
                // Validate user UUID
                if (!LoginController.UUID_REGEX.test(user.userId)) {
                    res.status(500).json({ success: false, message: "Invalid user ID format." });
                    return;
                }
                // Password verification
                let isMatch = false;
                if (user.password) {
                    isMatch = yield bcrypt.compare(password, user.password);
                }
                if (!isMatch) {
                    res.status(401).json({ success: false, message: "Incorrect password. Please try again." });
                    return;
                }
                // Validate organization
                if (!user.organizations || user.organizations.length === 0) {
                    res.status(401).json({ success: false, message: "User is not associated with any organization." });
                    return;
                }
                const firstOrganization = user.organizations[0];
                if (!LoginController.UUID_REGEX.test(firstOrganization.organizationId)) {
                    res.status(500).json({ success: false, message: "Invalid organization ID format." });
                    return;
                }
                // Generate JWT token for authentication
                const token = jsonwebtoken_1.default.sign({
                    userId: user.userId,
                    email: user.email,
                    username: user.username,
                    phoneNumber: user.phoneNumber,
                    organizationId: firstOrganization.organizationId,
                    roleId: user.role.roleId,
                    roleName: user.role.roleName,
                }, SECRET_KEY, { expiresIn: "24h" });
                res.cookie("authToken", token, {
                    httpOnly: true,
                    maxAge: COOKIE_EXPIRATION,
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                    secure: process.env.NODE_ENV === "production",
                });
                const { password: _ } = user, userData = __rest(user, ["password"]);
                // Generate password reset token
                const resetToken = jsonwebtoken_1.default.sign({
                    userId: user.userId,
                    email: user.email,
                    username: user.username,
                    purpose: "password_reset",
                }, SECRET_KEY, { expiresIn: "1h" });
                // Create reset link
                const baseUrl = process.env.FRONTEND_URL || "http://localhost:5000";
                const resetLink = `${baseUrl}/pages/reset-password?token=${resetToken}`;
                // Log the reset link for debugging
                console.log(`[Password Reset Email] Generated reset link: ${resetLink}`);
                // Send reset link to user's email
                try {
                    yield EmailService_1.default.sendPasswordResetEmail(user.email, resetLink, user.username);
                    console.log(`[Password Reset Email] Successfully sent to ${user.email}`);
                }
                catch (emailError) {
                    console.error(`[Password Reset Email] Failed to send to ${user.email}:`, emailError);
                    res.status(500).json({
                        success: false,
                        message: "Login successful, but failed to send password reset email.",
                        user: Object.assign(Object.assign({}, userData), { needsPasswordReset: true }),
                        token,
                    });
                    return;
                }
                res.status(200).json({
                    success: true,
                    message: "Login successful! Please check your email to reset your password.",
                    user: Object.assign(Object.assign({}, userData), { needsPasswordReset: true }),
                    token, // regular auth token
                    resetToken, // <-- add the reset token for direct use in Postman/testing
                    resetLink, // Optionally return the link for testing
                });
            }
            catch (error) {
                console.error(`[Login Error] Identifier: ${identifier} - ${error instanceof Error ? error.message : "Unknown error"}`);
                res.status(500).json({
                    success: false,
                    message: "Something went wrong while logging in.",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Login using user password
     * @route POST /api/auth/login
     * @access Public
     */
    static login(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { identifier, password } = req.body;
            // Validate request
            if (!identifier || !password) {
                console.log(`[Login Attempt] Identifier: ${identifier} - Missing identifier or password`);
                res.status(400).json({ success: false, message: "Please provide both identifier and password." });
                return;
            }
            const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
            try {
                const cacheKey = `user:identifier:${identifier}`;
                const user = yield CacheService_1.CacheService.getOrSetSingle(cacheKey, userRepository, () => __awaiter(this, void 0, void 0, function* () {
                    return yield userRepository.findOne({
                        where: [
                            { email: identifier },
                            { username: identifier },
                            { phoneNumber: identifier }
                        ],
                        relations: [
                            "organizations",
                            "organizations.venues",
                            "role",
                            "role.permissions",
                            "venues"
                        ]
                    });
                }), CACHE_TTL);
                if (!user) {
                    console.log(`[Login Attempt] Identifier: ${identifier} - No account found`);
                    res.status(404).json({ success: false, "message": "No account found with that email, username, or phone number." });
                    return;
                }
                // Validate user UUID
                if (!LoginController.UUID_REGEX.test(user.userId)) {
                    console.log(`[Login Attempt] User ID: ${user.userId} - Invalid UUID format`);
                    res.status(500).json({ success: false, message: "Invalid user ID format." });
                    return;
                }
                // Check password
                if (!user.password || !(yield bcrypt.compare(password, user.password))) {
                    console.log(`[Login Attempt] User ID: ${user.userId} - Incorrect password`);
                    res.status(401).json({ success: false, message: "Incorrect password. Please try again." });
                    return;
                }
                // Validate organization
                if (!user.organizations || user.organizations.length === 0) {
                    console.log(`[Login Attempt] User ID: ${user.userId} - No associated organizations`);
                    res.status(401).json({ success: false, message: "User is not associated with any organization." });
                    return;
                }
                const firstOrganization = user.organizations[0];
                // Filter venues and only include approved events for each venue
                const venuesWithApprovedEvents = (firstOrganization.venues || []).map(venue => (Object.assign(Object.assign({}, venue), { events: (venue.events || []).filter(event => event.status === "APPROVED") })));
                const organization = {
                    organizationId: firstOrganization.organizationId,
                    organizationName: firstOrganization.organizationName,
                    description: firstOrganization.description,
                    contactEmail: firstOrganization.contactEmail,
                    contactPhone: firstOrganization.contactPhone,
                    address: firstOrganization.address,
                    organizationType: firstOrganization.organizationType,
                };
                // Generate JWT token
                const token = jsonwebtoken_1.default.sign({
                    userId: user.userId,
                    email: user.email,
                    username: user.username,
                    phoneNumber: user.phoneNumber,
                    organizationId: firstOrganization.organizationId,
                    roles: {
                        roleId: user.role.roleId,
                        roleName: user.role.roleName,
                    },
                }, SECRET_KEY, { expiresIn: "24h" });
                res.cookie("authToken", token, {
                    httpOnly: true,
                    maxAge: COOKIE_EXPIRATION,
                    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
                    secure: process.env.NODE_ENV === "production",
                });
                console.log(`[Login Success] User ID: ${user.userId}, Role: ${user.role.roleName}, Organization ID: ${firstOrganization.organizationId}`);
                user.role.permissions.forEach(permission => {
                    console.log({
                        userId: user.userId,
                        username: user.username,
                        roleId: user.role.roleId,
                        roleName: user.role.roleName,
                        permissionId: permission.id,
                        permissionName: permission.name,
                        permissionDescription: permission.description,
                    });
                });
                res.status(200).json({
                    success: true,
                    message: "Login successful!",
                    user: {
                        userId: user.userId,
                        email: user.email,
                        username: user.username,
                        phoneNumber: user.phoneNumber,
                        roles: user.role,
                        organization // <-- now includes venues and only approved events
                    },
                    token,
                });
            }
            catch (error) {
                console.error(`[Login Error] Identifier: ${identifier} - ${error instanceof Error ? error.message : "Unknown error"}`);
                res.status(500).json({
                    success: false,
                    message: "Something went wrong while logging in.",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
}
exports.LoginController = LoginController;
LoginController.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
