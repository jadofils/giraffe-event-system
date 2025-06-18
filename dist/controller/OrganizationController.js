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
class OrganizationController {
    /**
     * Get all organizations
     * @route GET /organizations
     * @access Protected
     */
    static getAll(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.getAll();
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
            if (!id || !this.UUID_REGEX.test(id)) {
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
     * Create a new organization
     * @route POST /organizations
     * @access Protected
     */
    static create(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const data = req.body;
            if (!data.organizationName || !data.contactEmail || !data.address || !data.organizationType) {
                res.status(400).json({
                    success: false,
                    message: "Required fields (name, email, address, type) are missing",
                });
                return;
            }
            try {
                const created = OrganizationRepository_1.OrganizationRepository.create(data);
                if (!created.success) {
                    res.status(400).json(created);
                    return;
                }
                const saved = yield OrganizationRepository_1.OrganizationRepository.save(created.data);
                res.status(saved.success ? 201 : saved.data ? 400 : 500).json(saved);
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
            const { organizations } = req.body;
            if (!(organizations === null || organizations === void 0 ? void 0 : organizations.length)) {
                res.status(400).json({
                    success: false,
                    message: "At least one organization is required",
                });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.bulkCreate(organizations);
                res.status(result.success ? 201 : 400).json(result);
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
            if (!id || !this.UUID_REGEX.test(id)) {
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
    static bulkUpdate(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const updates = req.body.updates;
            if (!(updates === null || updates === void 0 ? void 0 : updates.length)) {
                res.status(400).json({
                    success: false,
                    message: "At least one organization update is required",
                });
                return;
            }
            try {
                const result = yield OrganizationRepository_1.OrganizationRepository.bulkUpdate(updates);
                res.status(result.success ? 200 : 400).json(result);
            }
            catch (error) {
                console.error("[OrganizationController BulkUpdate Error]:", error);
                res.status(500).json({
                    success: false,
                    message: "Internal server error",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        });
    }
    /**
     * Delete an organization
     * @route DELETE /organizations/:id
     * @access Protected
     */
    static delete(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            if (!id || !this.UUID_REGEX.test(id)) {
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
            if (!id || !this.UUID_REGEX.test(id)) {
                res.status(400).json({ success: false, message: "Valid organization ID is required" });
                return;
            }
            if (!(userIds === null || userIds === void 0 ? void 0 : userIds.length) || userIds.some((uid) => !this.UUID_REGEX.test(uid))) {
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
            if (!id || !this.UUID_REGEX.test(id)) {
                res.status(400).json({ success: false, message: "Valid organization ID is required" });
                return;
            }
            if (!(userIds === null || userIds === void 0 ? void 0 : userIds.length) || userIds.some((uid) => !this.UUID_REGEX.test(uid))) {
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
            if (!id || !this.UUID_REGEX.test(id)) {
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
}
exports.OrganizationController = OrganizationController;
OrganizationController.UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
