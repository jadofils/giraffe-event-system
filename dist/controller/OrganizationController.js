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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationController = void 0;
const OrganizationRepository_1 = require("../repositories/OrganizationRepository");
const CloudinaryUploadService_1 = require("../services/CloudinaryUploadService");
const OrganizationStatusEnum_1 = require("../interfaces/Enums/OrganizationStatusEnum");
class OrganizationController {
    /**
     * Get all organizations
     * @route GET /organizations
     * @access Protected
     */
    static getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("Calling OrganizationRepository.getAll()");
                const result = yield OrganizationRepository_1.OrganizationRepository.getAll();
                console.log("Result from OrganizationRepository.getAll():", result);
                res.status(result.success ? 200 : 500).json(result);
            }
            catch (error) {
                console.error("[OrganizationController GetAll Error]:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Get organization by ID
     * @route GET /organizations/:id
     * @access Protected
     */
    static getById(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(id)) {
                res.status(400).json({ success: false, message: "Valid organization ID is required" });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.getById(id);
                res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
            }
            catch (error) {
                console.error(`[OrganizationController GetById Error] ID: ${id}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Create a single organization (with file upload)
     * @route POST /organizations
     * @access Protected
     */
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
            const isAdmin = (_b = req.user) === null || _b === void 0 ? void 0 : _b.isAdmin;
            try {
                // Parse fields from form-data
                const { organizationName, description, contactEmail, contactPhone, address, organizationType, city, country, postalCode, stateProvince } = req.body;
                // Validate required fields
                if (!organizationName || !contactEmail) {
                    res.status(400).json({ success: false, message: "organizationName and contactEmail are required." });
                    return;
                }
                // Handle file upload if present
                let supportingDocumentUrl = undefined;
                if (req.file) {
                    // Only allow images and pdf
                    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp"];
                    if (!allowedTypes.includes(req.file.mimetype)) {
                        res.status(400).json({ success: false, message: "Only PDF and image files are allowed as supporting documents." });
                        return;
                    }
                    const uploadResult = yield CloudinaryUploadService_1.CloudinaryUploadService.uploadBuffer(req.file.buffer, "uploads/organization-supporting-document");
                    supportingDocumentUrl = uploadResult.url;
                }
                // Build organization object
                const orgData = {
                    organizationName,
                    description,
                    contactEmail,
                    contactPhone,
                    address,
                    organizationType,
                    city,
                    country,
                    postalCode,
                    stateProvince,
                    supportingDocument: supportingDocumentUrl,
                    status: isAdmin ? OrganizationStatusEnum_1.OrganizationStatusEnum.APPROVED : OrganizationStatusEnum_1.OrganizationStatusEnum.PENDING
                };
                // Use bulkCreate for consistency (single item array)
                const result = yield OrganizationRepository_1.OrganizationRepository.bulkCreate([orgData]);
                if (!result.success || !((_c = result.data) === null || _c === void 0 ? void 0 : _c.length)) {
                    res.status(400).json(result);
                    return;
                }
                // Assign the creator as a user to the organization
                yield OrganizationRepository_1.OrganizationRepository.assignUsersToOrganization([userId], result.data[0].organizationId);
                res.status(201).json({
                    success: true,
                    data: result.data[0],
                    message: "Organization created and creator assigned."
                });
            }
            catch (error) {
                console.error("[OrganizationController Create Error]:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Create multiple organizations
     * @route POST /organizations/bulk
     * @access Protected
     */
    static bulkCreate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            const { organizations } = req.body;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId; // <-- Get userId from token (auth middleware must set req.user)
            const isAdmin = (_b = req.user) === null || _b === void 0 ? void 0 : _b.isAdmin;
            if (!(organizations === null || organizations === void 0 ? void 0 : organizations.length)) {
                res.status(400).json({
                    success: false,
                    message: "At least one organization is required",
                });
                return;
            }
            if (!userId) {
                res.status(401).json({ success: false, message: "Unauthorized: User not found in token." });
                return;
            }
            try {
                // Set status for each organization based on creator's role
                const organizationsWithStatus = organizations.map(org => (Object.assign(Object.assign({}, org), { status: isAdmin ? OrganizationStatusEnum_1.OrganizationStatusEnum.APPROVED : OrganizationStatusEnum_1.OrganizationStatusEnum.PENDING })));
                // 1. Create organizations
                const result = yield OrganizationRepository_1.OrganizationRepository.bulkCreate(organizationsWithStatus);
                if (!result.success || !((_c = result.data) === null || _c === void 0 ? void 0 : _c.length)) {
                    res.status(400).json(result);
                    return;
                }
                // 2. Assign the creator as a user to each organization
                for (const org of result.data) {
                    yield OrganizationRepository_1.OrganizationRepository.assignUsersToOrganization([userId], org.organizationId);
                }
                res.status(201).json(Object.assign(Object.assign({}, result), { message: "Organizations created and creator assigned." }));
            }
            catch (error) {
                console.error("[OrganizationController BulkCreate Error]:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Update an organization
     * @route PUT /organizations/:id
     * @access Protected
     */
    static update(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const data = req.body;
            if (!id || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(id)) {
                res.status(400).json({ success: false, message: "Valid organization ID is required" });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.update(id, data);
                res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
            }
            catch (error) {
                console.error(`[OrganizationController Update Error] ID: ${id}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Update multiple organizations
     * @route PUT /organizations/bulk
     * @access Protected
     */
    /**
     * Delete an organization
     * @route DELETE /organizations/:id
     * @access Protected
     */
    static delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(id)) {
                res.status(400).json({ success: false, message: "Valid organization ID is required" });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.delete(id);
                res.status(result.success ? 200 : 404).json(result);
            }
            catch (error) {
                console.error(`[OrganizationController Delete Error] ID: ${id}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Assign users to an organization
     * @route POST /organizations/:id/users
     * @access Protected
     */
    static assignUsers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { userIds } = req.body;
            if (!id || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(id)) {
                res.status(400).json({ success: false, message: "Valid organization ID is required" });
                return;
            }
            if (!(userIds === null || userIds === void 0 ? void 0 : userIds.length) || userIds.some((uid) => !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(uid))) {
                res.status(400).json({ success: false, message: "Valid user IDs are required" });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.assignUsersToOrganization(userIds, id);
                res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
            }
            catch (error) {
                console.error(`[OrganizationController AssignUsers Error] Org ID: ${id}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Remove users from an organization
     * @route DELETE /organizations/:id/users
     * @access Protected
     */
    static removeUsers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { userIds } = req.body;
            if (!id || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(id)) {
                res.status(400).json({ success: false, message: "Valid organization ID is required" });
                return;
            }
            if (!(userIds === null || userIds === void 0 ? void 0 : userIds.length) || userIds.some((uid) => !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(uid))) {
                res.status(400).json({ success: false, message: "Valid user IDs are required" });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.removeUsersFromOrganization(userIds, id);
                res.status(result.success ? 200 : result.data ? 400 : 404).json(result);
            }
            catch (error) {
                console.error(`[OrganizationController RemoveUsers Error] Org ID: ${id}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Get users for an organization
     * @route GET /organizations/:id/users
     * @access Protected
     */
    static getUsers(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(id)) {
                res.status(400).json({ success: false, message: "Valid organization ID is required" });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.getUsersByOrganization(id);
                res.status(result.success ? 200 : 404).json(result);
            }
            catch (error) {
                console.error(`[OrganizationController GetUsers Error] Org ID: ${id}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Add one or more venues to an organization
     * @route POST /organizations/:organizationId/venues
     * @access Protected
     */
    static addVenues(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { organizationId } = req.params;
            const { venueIds } = req.body;
            if (!organizationId || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(organizationId)) {
                res.status(400).json({ success: false, message: "Valid organization ID (UUID) is required." });
                return;
            }
            if (!Array.isArray(venueIds) || venueIds.length === 0 || venueIds.some((vid) => !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(vid))) {
                res.status(400).json({ success: false, message: "A valid array of venue IDs (UUIDs) is required." });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.addVenuesToOrganization(organizationId, venueIds);
                if (result.success) {
                    res.status(200).json(result); // 200 OK, message indicates if any were already assigned
                }
                else {
                    // More specific error handling based on repository message
                    if (result.message === "Organization not found") {
                        res.status(404).json(result);
                    }
                    else if (result.message.includes("Venue") && result.message.includes("already assigned to another organization")) {
                        res.status(409).json(result); // Conflict
                    }
                    else if (result.message.includes("venue(s) not found")) {
                        res.status(404).json(result); // Specific venues not found
                    }
                    else {
                        res.status(400).json(result); // Generic bad request
                    }
                }
            }
            catch (error) {
                console.error(`[OrganizationController AddVenues Error] Org ID: ${organizationId}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error occurred while adding venues to organization.",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Remove one or more venues from an organization
     * @route DELETE /organizations/:organizationId/venues
     * @access Protected
     */
    static removeVenues(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { organizationId } = req.params;
            const { venueIds } = req.body; // Using body for DELETE with payload
            if (!organizationId || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(organizationId)) {
                res.status(400).json({ success: false, message: "Valid organization ID (UUID) is required." });
                return;
            }
            if (!Array.isArray(venueIds) || venueIds.length === 0 || venueIds.some((vid) => !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(vid))) {
                res.status(400).json({ success: false, message: "A valid array of venue IDs (UUIDs) is required." });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.removeVenuesFromOrganization(organizationId, venueIds);
                if (result.success) {
                    res.status(200).json(result);
                }
                else {
                    // More specific error handling based on repository message
                    if (result.message === "Organization not found") {
                        res.status(404).json(result);
                    }
                    else if (result.message.includes("No specified venues found linked to this organization to remove")) {
                        res.status(404).json(result); // Or 200 with a message if it's considered non-error
                    }
                    else {
                        res.status(400).json(result);
                    }
                }
            }
            catch (error) {
                console.error(`[OrganizationController RemoveVenues Error] Org ID: ${organizationId}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error occurred while removing venues from organization.",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    // You might want a method to get venues by organization as well
    /**
     * Get venues for a specific organization
     * @route GET /organizations/:organizationId/venues
     * @access Protected
     */
    static getOrganizationVenues(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const { organizationId } = req.params;
            if (!organizationId || !OrganizationRepository_1.OrganizationRepository.UUID_REGEX.test(organizationId)) {
                res.status(400).json({ success: false, message: "Valid organization ID (UUID) is required." });
                return;
            }
            try {
                // Assuming you have a VenueRepository with a method like getVenuesByOrganizationId
                // Or you can extend the OrganizationRepository to fetch organizations with their venues
                const result = yield OrganizationRepository_1.OrganizationRepository.getById(organizationId); // Fetch organization with venues and users relation
                if (result.success && result.data) {
                    res.status(200).json({
                        success: true,
                        data: {
                            venues: result.data.venues || [],
                            users: result.data.users || []
                        },
                        message: (((_a = result.data.venues) === null || _a === void 0 ? void 0 : _a.length) > 0 || ((_b = result.data.users) === null || _b === void 0 ? void 0 : _b.length) > 0)
                            ? "Venues and users retrieved successfully."
                            : "No venues or users found for this organization.",
                    });
                }
                else {
                    res.status(result.message === "Organization not found" ? 404 : 400).json(result);
                }
            }
            catch (error) {
                console.error(`[OrganizationController GetOrganizationVenues Error] Org ID: ${organizationId}:`, error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error occurred while fetching venues for organization.",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    static approve(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const result = yield OrganizationRepository_1.OrganizationRepository.approveOrganization(id);
            if (result.success) {
                res.status(200).json({ success: true, message: result.message, data: result.data });
            }
            else {
                res.status(400).json({ success: false, message: result.message });
            }
        });
    }
    static reject(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const { reason } = req.body;
            const result = yield OrganizationRepository_1.OrganizationRepository.rejectOrganization(id, reason);
            if (result.success) {
                res.status(200).json({ success: true, message: result.message, data: result.data });
            }
            else {
                res.status(400).json({ success: false, message: result.message });
            }
        });
    }
}
exports.OrganizationController = OrganizationController;
