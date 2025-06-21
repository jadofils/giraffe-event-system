"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserController = void 0;
const UserRepository_1 = require("../../repositories/UserRepository");
const Database_1 = require("../../config/Database");
const User_1 = require("../../models/User");
const EmailService_1 = __importDefault(require("../../services/emails/EmailService")); // Assuming this is correct
const Role_1 = require("../../models/Role");
const Organization_1 = require("../../models/Organization"); // Import Organization model
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const OrganizationRepository_1 = require("../../repositories/OrganizationRepository");
class UserController {
    static register(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const usersData = Array.isArray(req.body) ? req.body : [req.body];
                const results = [];
                // First, check for existing users
                const existingUsersMap = yield UserRepository_1.UserRepository.findExistingUsers(usersData.map((data) => ({
                    email: data.email || "",
                    username: data.username || "",
                    phoneNumber: data.phoneNumber || "",
                })));
                // Process each user
                for (const userInput of usersData) {
                    const { username, firstName, lastName, email, phoneNumber, password, confirmPassword, bio, profilePictureURL, preferredLanguage, timezone, emailNotificationsEnabled, smsNotificationsEnabled, socialMediaLinks, dateOfBirth, gender, addressLine1, addressLine2, city, stateProvince, postalCode, country, organization: organizationNameFromRequest, } = userInput;
                    // Check if user already exists
                    if ((email && existingUsersMap.has(email)) ||
                        (username && existingUsersMap.has(username))) {
                        results.push({
                            success: false,
                            message: "User already exists with that username or email.",
                            user: { username, email },
                        });
                        continue;
                    }
                    // === Input Validation ===
                    const errors = [];
                    if (!username || username.length < 3 || username.length > 50) {
                        errors.push("Username must be between 3 and 50 characters.");
                    }
                    if (!firstName || firstName.length < 1 || firstName.length > 50) {
                        errors.push("First name must be between 1 and 50 characters.");
                    }
                    if (!lastName || lastName.length < 1 || lastName.length > 50) {
                        errors.push("Last name must be between 1 and 50 characters.");
                    }
                    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                        errors.push("Invalid email format.");
                    }
                    if (phoneNumber && !/^\+?[1-9]\d{1,14}$/.test(phoneNumber)) {
                        errors.push("Invalid phone number format.");
                    }
                    // Password validation only if password is provided
                    if (password) {
                        if (password.length < 6) {
                            errors.push("Password must be at least 6 characters long.");
                        }
                        if (password !== confirmPassword) {
                            errors.push("Passwords do not match.");
                        }
                        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d]{6,}$/;
                        if (!passwordRegex.test(password)) {
                            errors.push("Password must contain at least one uppercase letter, one lowercase letter, and one number.");
                        }
                    }
                    if (errors.length > 0) {
                        results.push({
                            success: false,
                            message: errors.join(" "),
                            user: { username, email },
                        });
                        continue;
                    }
                    // === Hash password only if provided ===
                    const hashedPassword = password
                        ? yield bcryptjs_1.default.hash(password, 10)
                        : undefined;
                    // === Default Role Assignment ===
                    const roleRepository = Database_1.AppDataSource.getRepository(Role_1.Role);
                    const guestRole = yield roleRepository.findOne({
                        where: { roleName: "GUEST" },
                    });
                    if (!guestRole) {
                        results.push({
                            success: false,
                            message: "Default GUEST role not found. Please initialize roles.",
                            user: { username, email },
                        });
                        continue;
                    }
                    // === Handle Organization ===
                    const organizationRepository = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                    const defaultOrgName = "Independent";
                    const effectiveOrgName = ((organizationNameFromRequest === null || organizationNameFromRequest === void 0 ? void 0 : organizationNameFromRequest.trim()) || defaultOrgName).toLowerCase() === "independent"
                        ? defaultOrgName
                        : organizationNameFromRequest.trim();
                    let userOrganization = yield organizationRepository.findOne({
                        where: { organizationName: effectiveOrgName },
                    });
                    if (!userOrganization && effectiveOrgName === defaultOrgName) {
                        userOrganization = organizationRepository.create({
                            organizationName: defaultOrgName,
                            organizationType: "General",
                            description: "Auto-created organization: Independent",
                            contactEmail: "admin@independent.com",
                        });
                        yield organizationRepository.save(userOrganization);
                    }
                    // === Create User Data ===
                    const userData = {
                        username,
                        firstName,
                        lastName,
                        email,
                        phoneNumber,
                        bio,
                        profilePictureURL,
                        preferredLanguage,
                        timezone,
                        emailNotificationsEnabled,
                        smsNotificationsEnabled,
                        socialMediaLinks,
                        dateOfBirth,
                        gender,
                        addressLine1,
                        addressLine2,
                        city,
                        stateProvince,
                        postalCode,
                        country,
                        roleId: guestRole.roleId,
                    };
                    // Only add password if it was provided
                    if (hashedPassword) {
                        Object.assign(userData, { password: hashedPassword });
                    }
                    // Create and save user
                    const user = UserRepository_1.UserRepository.createUser(userData);
                    const savedUser = yield Database_1.AppDataSource.getRepository(User_1.User).save(user);
                    if (userOrganization) {
                        savedUser.organizations = [userOrganization];
                        yield Database_1.AppDataSource.getRepository(User_1.User).save(savedUser);
                    }
                    const completeUser = yield Database_1.AppDataSource.getRepository(User_1.User).findOne({
                        where: { userId: savedUser.userId },
                        relations: ["role", "organizations"],
                    });
                    if (!completeUser) {
                        results.push({
                            success: false,
                            message: "User registration failed during final fetch.",
                            user: { username, email },
                        });
                        continue;
                    }
                    // === Optional: Send welcome email ===
                    try {
                        const emailSent = yield EmailService_1.default.sendDefaultPassword(email, completeUser.lastName, completeUser.firstName, completeUser.username, req);
                        if (!emailSent) {
                            console.warn(`Email not sent to ${email}, but user created.`);
                        }
                    }
                    catch (emailErr) {
                        console.error("Email sending error:", emailErr);
                    }
                    // === Add successful result ===
                    const userResponse = {
                        userId: completeUser.userId,
                        username: completeUser.username,
                        email: completeUser.email,
                        firstName: completeUser.firstName,
                        lastName: completeUser.lastName,
                        phoneNumber: completeUser.phoneNumber,
                        bio: completeUser.bio,
                        profilePictureURL: completeUser.profilePictureURL,
                        preferredLanguage: completeUser.preferredLanguage,
                        timezone: completeUser.timezone,
                        emailNotificationsEnabled: completeUser.emailNotificationsEnabled,
                        smsNotificationsEnabled: completeUser.smsNotificationsEnabled,
                        socialMediaLinks: completeUser.socialMediaLinks,
                        dateOfBirth: completeUser.dateOfBirth,
                        gender: completeUser.gender,
                        addressLine1: completeUser.addressLine1,
                        addressLine2: completeUser.addressLine2,
                        city: completeUser.city,
                        stateProvince: completeUser.stateProvince,
                        postalCode: completeUser.postalCode,
                        country: completeUser.country,
                        role: completeUser.role
                            ? {
                                roleId: completeUser.role.roleId,
                                roleName: completeUser.role.roleName,
                                permissions: completeUser.role.permissions || [],
                            }
                            : null,
                        organizations: ((_a = completeUser.organizations) === null || _a === void 0 ? void 0 : _a.map((org) => ({
                            organizationId: org.organizationId,
                            organizationName: org.organizationName,
                            contactEmail: org.contactEmail,
                            contactPhone: org.contactPhone,
                            address: org.address,
                            city: org.city,
                            country: org.country,
                            postalCode: org.postalCode,
                            stateProvince: org.stateProvince,
                            organizationType: org.organizationType,
                            description: org.description,
                            createdAt: org.createdAt,
                            updatedAt: org.updatedAt,
                            deletedAt: org.deletedAt,
                        }))) || [],
                    };
                    results.push({
                        success: true,
                        message: "User registered successfully.",
                        user: userResponse,
                    });
                }
                // === Send Response ===
                const allSuccessful = results.every((result) => result.success);
                const statusCode = allSuccessful
                    ? 201
                    : results.some((result) => result.success)
                        ? 207
                        : 400;
                res.status(statusCode).json({
                    success: allSuccessful,
                    message: allSuccessful
                        ? "All users registered successfully"
                        : "Some users failed to register",
                    results,
                });
            }
            catch (err) {
                console.error("Unexpected error during registration:", err);
                res
                    .status(500)
                    .json({ success: false, message: "Internal server error." });
            }
        });
    }
    static getProfile(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res.status(200).json({ success: true, message: "User profile retrieved" });
        });
    }
    static updateProfile(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            res
                .status(200)
                .json({ success: true, message: "Profile updated successfully" });
        });
    }
    static getAllUsers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const users = yield UserRepository_1.UserRepository.getAllUsers();
                if (!users || users.length === 0) {
                    res.status(404).json({ success: false, message: "No users found" });
                    return;
                }
                const formattedUsers = users.map((user) => {
                    var _a;
                    return ({
                        userId: user === null || user === void 0 ? void 0 : user.userId,
                        username: user === null || user === void 0 ? void 0 : user.username,
                        firstName: user === null || user === void 0 ? void 0 : user.firstName,
                        lastName: user === null || user === void 0 ? void 0 : user.lastName,
                        email: user === null || user === void 0 ? void 0 : user.email,
                        phoneNumber: user === null || user === void 0 ? void 0 : user.phoneNumber,
                        // Include new optional fields
                        bio: user === null || user === void 0 ? void 0 : user.bio,
                        profilePictureURL: user === null || user === void 0 ? void 0 : user.profilePictureURL,
                        preferredLanguage: user === null || user === void 0 ? void 0 : user.preferredLanguage,
                        timezone: user === null || user === void 0 ? void 0 : user.timezone,
                        emailNotificationsEnabled: user === null || user === void 0 ? void 0 : user.emailNotificationsEnabled,
                        smsNotificationsEnabled: user === null || user === void 0 ? void 0 : user.smsNotificationsEnabled,
                        socialMediaLinks: user === null || user === void 0 ? void 0 : user.socialMediaLinks,
                        dateOfBirth: user === null || user === void 0 ? void 0 : user.dateOfBirth,
                        gender: user === null || user === void 0 ? void 0 : user.gender,
                        addressLine1: user === null || user === void 0 ? void 0 : user.addressLine1,
                        addressLine2: user === null || user === void 0 ? void 0 : user.addressLine2,
                        city: user === null || user === void 0 ? void 0 : user.city,
                        stateProvince: user === null || user === void 0 ? void 0 : user.stateProvince,
                        postalCode: user === null || user === void 0 ? void 0 : user.postalCode,
                        country: user === null || user === void 0 ? void 0 : user.country,
                        // Relationships
                        role: (user === null || user === void 0 ? void 0 : user.role)
                            ? {
                                roleId: user.role.roleId,
                                roleName: user.role.roleName,
                                permissions: user.role.permissions || [],
                            }
                            : null,
                        // Corrected: 'organization' is singular and an object, not an array
                        organization: ((_a = user === null || user === void 0 ? void 0 : user.organizations) === null || _a === void 0 ? void 0 : _a[0])
                            ? {
                                organizationId: user.organizations[0].organizationId,
                                organizationName: user.organizations[0].organizationName,
                                description: user.organizations[0].description || "",
                                contactEmail: user.organizations[0].contactEmail,
                                contactPhone: user.organizations[0].contactPhone || "",
                                address: user.organizations[0].address || "",
                                organizationType: user.organizations[0].organizationType || "",
                            }
                            : null,
                    });
                });
                res.status(200).json({ success: true, users: formattedUsers });
            }
            catch (error) {
                console.error("Error in getAllUsers:", error);
                res
                    .status(500)
                    .json({ success: false, message: "Internal server error" });
            }
        });
    }
    static getUserById(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                const { id } = req.params;
                const user = yield UserRepository_1.UserRepository.getUserById(id);
                if (!user) {
                    res.status(404).json({ success: false, message: "User not found" });
                    return;
                }
                const formattedUser = {
                    userId: user.userId,
                    username: user.username,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    bio: user.bio,
                    profilePictureURL: user.profilePictureURL,
                    preferredLanguage: user.preferredLanguage,
                    timezone: user.timezone,
                    emailNotificationsEnabled: user.emailNotificationsEnabled,
                    smsNotificationsEnabled: user.smsNotificationsEnabled,
                    socialMediaLinks: user.socialMediaLinks,
                    dateOfBirth: user.dateOfBirth,
                    gender: user.gender,
                    addressLine1: user.addressLine1,
                    addressLine2: user.addressLine2,
                    city: user.city,
                    stateProvince: user.stateProvince,
                    postalCode: user.postalCode,
                    country: user.country,
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                    deletedAt: user.deletedAt,
                    role: user.role
                        ? {
                            roleId: user.role.roleId,
                            roleName: user.role.roleName,
                            description: user.role.description,
                            createdAt: user.role.createdAt,
                            updatedAt: user.role.updatedAt,
                            deletedAt: user.role.deletedAt,
                            permissions: Array.isArray(user.role.permissions)
                                ? user.role.permissions.map((permission) => ({
                                    id: permission.id,
                                    name: permission.name,
                                    description: permission.description,
                                }))
                                : [],
                        }
                        : null,
                    organizations: Array.isArray(user.organizations)
                        ? user.organizations.map((org) => ({
                            organizationId: org.organizationId,
                            organizationName: org.organizationName,
                            description: org.description,
                            contactEmail: org.contactEmail,
                            contactPhone: org.contactPhone,
                            address: org.address,
                            city: org.city,
                            country: org.country,
                            postalCode: org.postalCode,
                            stateProvince: org.stateProvince,
                            organizationType: org.organizationType,
                            createdAt: org.createdAt,
                            updatedAt: org.updatedAt,
                            deletedAt: org.deletedAt,
                        }))
                        : [],
                    registrations: ((_a = user.registrationsAsAttendee) === null || _a === void 0 ? void 0 : _a.map((registration) => ({
                        registrationId: registration.registrationId,
                        eventId: registration.eventId,
                        userId: registration.userId,
                        buyerId: registration.buyerId,
                        boughtForIds: registration.boughtForIds,
                        ticketTypeId: registration.ticketTypeId,
                        venueId: registration.venueId,
                        noOfTickets: registration.noOfTickets,
                        registrationDate: registration.registrationDate,
                        paymentStatus: registration.paymentStatus,
                        qrCode: registration.qrCode,
                        checkDate: registration.checkDate,
                        attended: registration.attended,
                        totalCost: registration.totalCost,
                        registrationStatus: registration.registrationStatus,
                        paymentId: registration.paymentId,
                        invoiceId: registration.invoiceId,
                        createdAt: registration.createdAt,
                        updatedAt: registration.updatedAt,
                        deletedAt: registration.deletedAt,
                        event: registration.event
                            ? {
                                eventId: registration.event.eventId,
                                eventTitle: registration.event.eventTitle,
                                description: registration.event.description,
                                eventType: registration.event.eventType,
                                startDate: registration.event.startDate,
                                endDate: registration.event.endDate,
                                startTime: registration.event.startTime,
                                endTime: registration.event.endTime,
                                maxAttendees: registration.event.maxAttendees,
                                status: registration.event.status,
                                isFeatured: registration.event.isFeatured,
                                qrCode: registration.event.qrCode,
                                imageURL: registration.event.imageURL,
                                organizerId: registration.event.organizerId,
                                organizationId: registration.event.organizationId,
                                createdAt: registration.event.createdAt,
                                updatedAt: registration.event.updatedAt,
                                deletedAt: registration.event.deletedAt,
                                organizer: registration.event.organizer
                                    ? {
                                        userId: registration.event.organizer.userId,
                                        username: registration.event.organizer.username,
                                        firstName: registration.event.organizer.firstName,
                                        lastName: registration.event.organizer.lastName,
                                        email: registration.event.organizer.email,
                                    }
                                    : null,
                                venues: Array.isArray(registration.event.venues)
                                    ? registration.event.venues.map((venue) => ({
                                        venueId: venue.venueId,
                                        venueName: venue.venueName,
                                    }))
                                    : [],
                                bookings: Array.isArray(registration.event.venueBookings)
                                    ? registration.event.venueBookings.map((booking) => ({
                                        bookingId: booking.bookingId,
                                    }))
                                    : [],
                                registrations: Array.isArray(registration.event.registrations)
                                    ? registration.event.registrations.map((reg) => ({
                                        registrationId: reg.registrationId,
                                    }))
                                    : [],
                                payments: Array.isArray(registration.event.payments)
                                    ? registration.event.payments.map((payment) => ({
                                        paymentId: payment.paymentId,
                                    }))
                                    : [],
                                invoices: Array.isArray(registration.event.invoices)
                                    ? registration.event.invoices.map((invoice) => ({
                                        invoiceId: invoice.invoiceId,
                                    }))
                                    : [],
                            }
                            : null,
                        ticketType: registration.ticketType
                            ? {
                                ticketTypeId: registration.ticketType.ticketTypeId,
                                ticketName: registration.ticketType.ticketName,
                            }
                            : null,
                        venue: registration.venue
                            ? {
                                venueId: registration.venue.venueId,
                                venueName: registration.venue.venueName,
                                capacity: registration.venue.capacity,
                                amount: registration.venue.amount,
                                location: registration.venue.location,
                                latitude: registration.venue.latitude,
                                longitude: registration.venue.longitude,
                                googleMapsLink: registration.venue.googleMapsLink,
                                managerId: registration.venue.managerId,
                                organizationId: registration.venue.organizationId,
                                amenities: registration.venue.amenities,
                                venueType: registration.venue.venueType,
                                contactPerson: registration.venue.contactPerson,
                                contactEmail: registration.venue.contactEmail,
                                contactPhone: registration.venue.contactPhone,
                                websiteURL: registration.venue.websiteURL,
                                createdAt: registration.venue.createdAt,
                                updatedAt: registration.venue.updatedAt,
                                deletedAt: registration.venue.deletedAt,
                            }
                            : null,
                        payment: registration.payment
                            ? {
                                paymentId: registration.payment.paymentId,
                            }
                            : null,
                        invoice: registration.invoice
                            ? {
                                invoiceId: registration.invoice.invoiceId,
                            }
                            : null,
                    }))) || [],
                    invoices: ((_b = user.invoices) === null || _b === void 0 ? void 0 : _b.map((invoice) => {
                        var _a;
                        return ({
                            invoiceId: invoice.invoiceId,
                            eventId: invoice.eventId,
                            userId: invoice.userId,
                            invoiceDate: invoice.invoiceDate,
                            dueDate: invoice.dueDate,
                            totalAmount: invoice.totalAmount,
                            status: invoice.status,
                            createdAt: invoice.createdAt,
                            updatedAt: invoice.updatedAt,
                            deletedAt: invoice.deletedAt,
                            payments: ((_a = invoice.payments) === null || _a === void 0 ? void 0 : _a.map((payment) => ({
                                paymentId: payment.paymentId,
                            }))) || [],
                            registration: invoice.registration
                                ? {
                                    registrationId: invoice.registration.registrationId,
                                }
                                : null,
                        });
                    })) || [],
                    venueBookings: ((_c = user.bookings) === null || _c === void 0 ? void 0 : _c.map((booking) => ({
                        bookingId: booking.bookingId,
                        eventId: booking.eventId,
                        venueId: booking.venueId,
                        user: booking.user
                            ? {
                                userId: booking.user.userId,
                                username: booking.user.username,
                                firstName: booking.user.firstName,
                                lastName: booking.user.lastName,
                                email: booking.user.email,
                                phoneNumber: booking.user.phoneNumber,
                                roleId: booking.user.roleId,
                                bio: booking.user.bio,
                                profilePictureURL: booking.user.profilePictureURL,
                                preferredLanguage: booking.user.preferredLanguage,
                                timezone: booking.user.timezone,
                                emailNotificationsEnabled: booking.user.emailNotificationsEnabled,
                                smsNotificationsEnabled: booking.user.smsNotificationsEnabled,
                                socialMediaLinks: booking.user.socialMediaLinks,
                                dateOfBirth: booking.user.dateOfBirth,
                                gender: booking.user.gender,
                                addressLine1: booking.user.addressLine1,
                                addressLine2: booking.user.addressLine2,
                                city: booking.user.city,
                                stateProvince: booking.user.stateProvince,
                                postalCode: booking.user.postalCode,
                                country: booking.user.country,
                                createdAt: booking.user.createdAt,
                                updatedAt: booking.user.updatedAt,
                                deletedAt: booking.user.deletedAt,
                            }
                            : null,
                        venue: booking.venue
                            ? {
                                venueId: booking.venue.venueId,
                                venueName: booking.venue.venueName,
                                capacity: booking.venue.capacity,
                                amount: booking.venue.amount,
                                location: booking.venue.location,
                                managerId: booking.venue.managerId,
                                latitude: booking.venue.latitude,
                                longitude: booking.venue.longitude,
                                googleMapsLink: booking.venue.googleMapsLink,
                                organizationId: booking.venue.organizationId,
                                amenities: booking.venue.amenities,
                                venueType: booking.venue.venueType,
                                contactPerson: booking.venue.contactPerson,
                                contactEmail: booking.venue.contactEmail,
                                contactPhone: booking.venue.contactPhone,
                                websiteURL: booking.venue.websiteURL,
                                createdAt: booking.venue.createdAt,
                                updatedAt: booking.venue.updatedAt,
                                deletedAt: booking.venue.deletedAt,
                            }
                            : null,
                        organization: booking.organization
                            ? {
                                organizationId: booking.organization.organizationId,
                                organizationName: booking.organization.organizationName,
                                description: booking.organization.description,
                                contactEmail: booking.organization.contactEmail,
                                contactPhone: booking.organization.contactPhone,
                                address: booking.organization.address,
                                organizationType: booking.organization.organizationType,
                                city: booking.organization.city,
                                country: booking.organization.country,
                                postalCode: booking.organization.postalCode,
                                stateProvince: booking.organization.stateProvince,
                                createdAt: booking.organization.createdAt,
                                updatedAt: booking.organization.updatedAt,
                                deletedAt: booking.organization.deletedAt,
                            }
                            : null,
                    }))) || [],
                    createdEvents: ((_d = user.createdEvents) === null || _d === void 0 ? void 0 : _d.map((event) => ({
                        eventId: event.eventId,
                        eventTitle: event.eventTitle,
                    }))) || [],
                };
                console.log(`Permissions in response for user ${id}: ${JSON.stringify(((_e = formattedUser.role) === null || _e === void 0 ? void 0 : _e.permissions) || [])}`);
                res.status(200).json({ success: true, user: formattedUser });
            }
            catch (error) {
                console.error("Error in getUserById:", error);
                res.status(500).json({ success: false, message: "Internal server error" });
            }
        });
    }
    static updateUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const userId = req.params.id;
                const userRepository = Database_1.AppDataSource.getRepository(User_1.User);
                const user = yield userRepository.findOne({
                    where: { userId },
                    relations: ["role", "organization"], // Include related entities
                });
                if (!user) {
                    res.status(404).json({ success: false, message: "User not found" });
                    return;
                }
                // Destructure all possible updatable fields, including new optional ones
                const updateData = req.body;
                // Update user fields if they exist in the request body
                // This is a more concise way to update all fields
                Object.assign(user, updateData);
                // Explicitly handle password if present (needs hashing)
                if (updateData.password) {
                    const hashedPassword = yield bcryptjs_1.default.hash(updateData.password, 10);
                    user.password = hashedPassword;
                }
                // Handle organization update if organizationName is provided
                if ((_a = updateData.organization) === null || _a === void 0 ? void 0 : _a.organizationName) {
                    const organizationRepository = Database_1.AppDataSource.getRepository(Organization_1.Organization);
                    let userOrganization = yield organizationRepository.findOne({
                        where: { organizationName: updateData.organization.organizationName },
                    });
                    if (!userOrganization) {
                        userOrganization = organizationRepository.create({
                            organizationName: updateData.organization.organizationName,
                            organizationType: "General",
                            description: `Auto-created during update: ${updateData.organization.organizationName}`,
                        });
                        yield organizationRepository.save(userOrganization);
                    }
                    user.organizations = [userOrganization];
                }
                const updatedUser = yield userRepository.save(user);
                res.status(200).json({
                    success: true,
                    message: "User updated successfully",
                    user: {
                        userId: updatedUser.userId,
                        username: updatedUser.username,
                        firstName: updatedUser.firstName,
                        lastName: updatedUser.lastName,
                        email: updatedUser.email,
                        phoneNumber: updatedUser.phoneNumber,
                        bio: updatedUser.bio,
                        profilePictureURL: updatedUser.profilePictureURL,
                        preferredLanguage: updatedUser.preferredLanguage,
                        timezone: updatedUser.timezone,
                        emailNotificationsEnabled: updatedUser.emailNotificationsEnabled,
                        smsNotificationsEnabled: updatedUser.smsNotificationsEnabled,
                        socialMediaLinks: updatedUser.socialMediaLinks,
                        dateOfBirth: updatedUser.dateOfBirth,
                        gender: updatedUser.gender,
                        addressLine1: updatedUser.addressLine1,
                        addressLine2: updatedUser.addressLine2,
                        city: updatedUser.city,
                        stateProvince: updatedUser.stateProvince,
                        postalCode: updatedUser.postalCode,
                        country: updatedUser.country,
                        role: updatedUser.role
                            ? {
                                roleId: updatedUser.role.roleId,
                                roleName: updatedUser.role.roleName,
                                permissions: updatedUser.role.permissions || [],
                            }
                            : null,
                        organizations: ((_b = updatedUser.organizations) === null || _b === void 0 ? void 0 : _b.map((org) => ({
                            organizationId: org.organizationId,
                            organizationName: org.organizationName,
                            contactEmail: org.contactEmail,
                            contactPhone: org.contactPhone,
                            address: org.address,
                            city: org.city,
                            country: org.country,
                            postalCode: org.postalCode,
                            stateProvince: org.stateProvince,
                            organizationType: org.organizationType,
                            description: org.description,
                            createdAt: org.createdAt,
                            updatedAt: org.updatedAt,
                            deletedAt: org.deletedAt,
                        }))) || [],
                    },
                });
            }
            catch (error) {
                console.error("Error in updateUser:", error);
                res
                    .status(500)
                    .json({ success: false, message: "Internal server error" });
            }
        });
    }
    static deleteUser(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id) {
                res.status(400).json({ success: false, message: "User ID is required" });
                return;
            }
            try {
                const result = yield UserRepository_1.UserRepository.deleteUser(id);
                if (result.success) {
                    res.status(200).json({ success: true, message: result.message });
                }
                else {
                    res.status(404).json({ success: false, message: result.message });
                }
            }
            catch (error) {
                console.error("Error in deleteUser:", error);
                res
                    .status(500)
                    .json({ success: false, message: "Internal server error" });
            }
        });
    }
    static updateDefaultUserRole(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { userId, roleId } = req.body;
                if (!userId || !roleId) {
                    res.status(400).json({ message: "User ID and Role ID are required" });
                    return;
                }
                const result = yield UserRepository_1.UserRepository.assignUserRole(userId, roleId);
                if (result.success) {
                    // Check success boolean rather than message string
                    res.status(200).json({ message: result.message, data: result });
                }
                else {
                    // Use the message from the repository for client response
                    res.status(400).json({ message: result.message });
                }
            }
            catch (error) {
                console.error("Error in updateDefaultUserRole:", error); // Corrected log message
                res.status(500).json({ message: "Internal server error" });
            }
        });
    }
    static updateAssignedUserRole(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                const { userId } = req.params;
                const { roleId } = req.body;
                if (!userId) {
                    res.status(400).json({
                        success: false,
                        message: "userId is required in the URL parameters",
                    });
                    return;
                }
                if (!roleId) {
                    res.status(400).json({
                        success: false,
                        message: "roleId is required in the request body",
                    });
                    return;
                }
                const result = yield UserRepository_1.UserRepository.updateUserRole(userId, roleId);
                if (result.success) {
                    res.status(200).json({
                        success: true,
                        message: result.message,
                        user: {
                            userId: (_a = result.user) === null || _a === void 0 ? void 0 : _a.userId,
                            username: (_b = result.user) === null || _b === void 0 ? void 0 : _b.username,
                            email: (_c = result.user) === null || _c === void 0 ? void 0 : _c.email,
                            role: {
                                roleId: (_d = result.newRole) === null || _d === void 0 ? void 0 : _d.roleId,
                                roleName: (_e = result.newRole) === null || _e === void 0 ? void 0 : _e.roleName,
                            },
                        },
                    });
                }
                else {
                    res.status(400).json({
                        success: false,
                        message: result.message,
                    });
                }
            }
            catch (error) {
                console.error("Error in updateAssignedUserRole controller:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error occurred while updating user role",
                });
            }
        });
    }
    static getMyOrganizations(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            if (!userId) {
                res.status(401).json({ success: false, message: "Unauthorized" });
                return;
            }
            const result = yield OrganizationRepository_1.OrganizationRepository.getOrganizationsByUserId(userId);
            res.status(result.success ? 200 : 404).json(result);
        });
    }
}
exports.UserController = UserController;
