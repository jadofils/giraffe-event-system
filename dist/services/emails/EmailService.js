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
exports.EmailService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class EmailService {
    /**
     * @deprecated Use sendTicketsEmail for multiple tickets or if you need a more structured single ticket email.
     */
    static sendTicketEmail(_a) {
        return __awaiter(this, arguments, void 0, function* ({ to, subject, eventName, eventDate, venueName, ticketPdf, qrCode, }) {
            try {
                const transporter = nodemailer_1.default.createTransport({
                    service: "gmail",
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS,
                    },
                });
                const mailOptions = {
                    from: `"Event Tickets" <${process.env.EMAIL_USER}>`,
                    to,
                    subject,
                    html: `
          <h2>Your Ticket for ${eventName}</h2>
          <p><strong>Event Date:</strong> ${eventDate.toDateString()}</p>
          <p><strong>Venue:</strong> ${venueName}</p>
          <p>Attached is your ticket. Please present the QR code below at the event.</p>
          ${qrCode ? `<img src="${qrCode}" alt="QR Code" width="150"/>` : ""}
          <p>Thank you for booking with us!</p>
        `,
                    attachments: [
                        {
                            filename: `${eventName}_Ticket.pdf`,
                            content: ticketPdf,
                            contentType: "application/pdf",
                        },
                    ],
                };
                yield transporter.sendMail(mailOptions);
                console.log(`Ticket email sent successfully to ${to}`);
                return true;
            }
            catch (error) {
                console.error("Error sending ticket email:", error);
                return false;
            }
        });
    }
    static sendTicketsEmail(_a) {
        return __awaiter(this, arguments, void 0, function* ({ to, subject, eventName, eventDate, venueName, tickets, venueGoogleMapsLink, // New parameter
         }) {
            try {
                const transporter = EmailService.getTransporter();
                const ticketHtml = tickets
                    .map((ticket) => `
        <div style="border: 1px solid #eee; padding: 15px; margin-bottom: 20px; border-radius: 8px;">
          <h3>Ticket: ${ticket.ticketName}</h3>
          <p><strong>Attendee:</strong> ${ticket.attendeeName}</p>
          <p><strong>Date for this ticket:</strong> ${new Date(ticket.attendedDate).toDateString()}</p>
          <p>Please present this QR code at the event entrance:</p>
          <img src="${ticket.qrCodeUrl}" alt="QR Code" width="150" style="display: block; margin: 10px 0;"/>
        </div>
      `)
                    .join("");
                const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); padding: 32px;">
          <h2 style="color: #003087;">Your Tickets for ${eventName}</h2>
          <p><strong>Event Date:</strong> ${eventDate.toDateString()}</p>
          <p><strong>Venue:</strong> ${venueName}
          ${venueGoogleMapsLink
                    ? ` (<a href="${venueGoogleMapsLink}" target="_blank">View on Map</a>)`
                    : ""}
          </p>
          <p>Here are your tickets. Please find the details and QR codes below for each ticket.</p>
          ${ticketHtml}
          <p>Thank you for your purchase!</p>
          <div style="margin-top: 32px; font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 16px;">
            Best regards,<br/>
            <b>Giraffe Event System Team</b>
          </div>
        </div>
      `;
                const mailOptions = {
                    from: `"Event Tickets" <${process.env.EMAIL_USER}>`,
                    to,
                    subject,
                    html: htmlContent,
                    // Attachments can be added here if you generate PDFs for each ticket dynamically
                };
                yield transporter.sendMail(mailOptions);
                console.log(`Tickets email sent successfully to ${to} for ${tickets.length} tickets.`);
                return true;
            }
            catch (error) {
                console.error("Error sending tickets email:", error);
                return false;
            }
        });
    }
    static log(level, message, ...meta) {
        const prefix = level.toUpperCase();
        console[level](`${prefix}: ${message}`, ...meta);
    }
    static generatePassword(length = this.PASSWORD_LENGTH) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    }
    static getTransporter() {
        if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
            throw new Error("GMAIL credentials not configured");
        }
        return nodemailer_1.default.createTransport({
            service: "gmail",
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_PASSWORD,
            },
        });
    }
    static generateWelcomeEmailContent(email, password, username, firstName, lastName) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<style>
body { font-family: Arial, sans-serif; background: #FFFFFF; color: #000000; }
.container { max-width: 600px; margin: 30px auto; background: #FFFFFF; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
.header { background-color: #003087; color: #FFFFFF; padding: 20px; text-align: center; font-size: 28px; }
.logo { display: block; margin: 0 auto 20px; width: 150px; }
.credentials { background: #f5f5f5; padding: 15px; border: 1px solid #ddd; border-radius: 10px; font-family: monospace; margin-top: 20px; }
.button { display: inline-block; background-color: #003087; color: #FFFFFF; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
.footer { background: #003087; color: #FFFFFF; text-align: center; padding: 15px; font-size: 14px; }
.footer a { color: #FFFFFF; text-decoration: underline; }
</style>
</head>
<body>
<div class="container">
<img src="https://res.cloudinary.com/dxxqpejtl/image/upload/v1752156721/WhatsApp_Image_2025-07-10_at_16.09.40_ea1ac0d3_jfpqup.jpg" alt="University of Rwanda Logo" class="logo" />
<div class="header">Welcome to University of Rwanda</div>
<h2>Hello ${firstName} ${lastName},</h2>
<p>Welcome to the <strong>University of Rwanda</strong> platform. Your account has been created successfully.</p>
<div class="credentials">
<strong>Your login credentials:</strong><br/>
Username: <b>${username}</b><br/>
First Name: <b>${firstName}</b><br/>
Last Name: <b>${lastName}</b><br/>
Email: <b>${email}</b><br/>
Password: <b>${password}</b><br/>
<p>Click To login:<a>https://giraffe-space.vercel.app/login</a></p>
</div>
<p style="margin-top:20px;">Please use these credentials to log in for the first time. You will be required to change your password after logging in.</p>
<div class="footer">
© ${new Date().getFullYear()} University of Rwanda. All rights reserved.<br/>
Need help? <a href="mailto:support@ur.ac.rw">Contact Support</a>
</div>
</div>
</body>
</html>`;
    }
    static generateResetEmailContent(resetLink, username) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: Arial, sans-serif; background: #FFFFFF; color: #000000; }
    .container { max-width: 600px; margin: 30px auto; background: #FFFFFF; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    .header { background-color: #003087; color: #FFFFFF; padding: 20px; text-align: center; font-size: 28px; }
    .logo { display: block; margin: 0 auto 20px; width: 150px; }
    .button { display: inline-block; background-color: #003087; color: #FFFFFF; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
    .footer { background: #003087; color: #FFFFFF; text-align: center; padding: 15px; font-size: 14px; }
    .footer a { color: #FFFFFF; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://www.ur.ac.rw/IMG/logo/logo_ur.jpg" alt="University of Rwanda Logo" class="logo" />
    <div class="header">University of Rwanda Password Reset</div>
    <h2>Hello ${username},</h2>
    <p>You've requested to reset your password for your University of Rwanda account.</p>
    <p>Click the button below to set a new password:</p>
    <div style="text-align: center;">
      <a href="${resetLink}" class="button">Reset Your Password</a>
    </div>
    <p><strong>This link will expire in 1 hour.</strong></p>
    <p>If you didn't request a password reset, please contact our support team at <a href="mailto:support@ur.ac.rw">support@ur.ac.rw</a>.</p>
    <div class="footer">
      © ${new Date().getFullYear()} University of Rwanda. All rights reserved.<br/>
      Need help? <a href="mailto:support@ur.ac.rw">Contact Support</a>
    </div>
  </div>
</body>
</html>`;
    }
    static sendPasswordResetEmail(email, resetLink, username) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const transporter = this.getTransporter();
                const mailOptions = {
                    from: process.env.GMAIL_USER,
                    to: email,
                    subject: "Reset Your University of Rwanda Password",
                    html: this.generateResetEmailContent(resetLink, username),
                };
                yield transporter.sendMail(mailOptions);
                this.log("info", `Password reset email sent to ${email}`);
            }
            catch (error) {
                this.log("error", `Failed to send password reset email to ${email}:`, error);
                throw error;
            }
        });
    }
    static sendDefaultPasswordWithPassword(email, lastName, firstName, username, password) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const transporter = this.getTransporter();
                const mailOptions = {
                    from: process.env.GMAIL_USER,
                    to: email,
                    subject: `Your Temporary University of Rwanda Login Credentials (Valid for ${this.EXPIRY_HOURS} Hours)`,
                    html: this.generateWelcomeEmailContent(email, password, username, firstName, lastName),
                };
                this.log("info", `Sending welcome email to ${email}`);
                const info = yield transporter.sendMail(mailOptions);
                this.log("info", "Welcome email sent successfully:", info.response);
                return true;
            }
            catch (error) {
                this.log("error", "Error in sendDefaultPasswordWithPassword:", error);
                return false;
            }
        });
    }
    static sendSuccessPasswordForgetEmail(email, username) {
        return __awaiter(this, void 0, void 0, function* () {
            const emailContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
    body { font-family: Arial, sans-serif; background: #FFFFFF; color: #000000; }
    .container { max-width: 600px; margin: 30px auto; background: #FFFFFF; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
    .header { background-color: #003087; color: #FFFFFF; padding: 20px; text-align: center; font-size: 28px; }
    .logo { display: block; margin: 0 auto 20px; width: 150px; }
    .button { display: inline-block; background-color: #003087; color: #FFFFFF; padding: 12px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; margin: 20px 0; }
    .footer { background: #003087; color: #FFFFFF; text-align: center; padding: 15px; font-size: 14px; }
    .footer a { color: #FFFFFF; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <img src="https://www.ur.ac.rw/IMG/logo/logo_ur.jpg" alt="University of Rwanda Logo" class="logo" />
    <div class="header">Password Reset Successful</div>
    <h2>Hello ${username},</h2>
    <p>Your password for your University of Rwanda account has been successfully changed.</p>
    <p>You can now log in with your new password.</p>
    <div style="text-align: center;">
      <a href="https://giraffe-space.vercel.app/login" class="button">Login to Your Account</a>
    </div>
    <p>Please keep your password secure and do not share it with anyone.</p>
    <p>If you didn't request this change, please contact our support team immediately at <a href="mailto:support@ur.ac.rw">support@ur.ac.rw</a>.</p>
    <div class="footer">
      © ${new Date().getFullYear()} University of Rwanda. All rights reserved.<br/>
      Need help? <a href="mailto:support@ur.ac.rw">Contact Support</a>
    </div>
  </div>
</body>
</html>`;
            try {
                const transporter = this.getTransporter();
                const mailOptions = {
                    from: process.env.GMAIL_USER,
                    to: email,
                    subject: "Your University of Rwanda Password Has Been Changed",
                    html: emailContent,
                };
                yield transporter.sendMail(mailOptions);
                this.log("info", `Password reset success email sent to ${email}`);
            }
            catch (error) {
                this.log("error", `Failed to send password reset success email to ${email}:`, error);
                throw error;
            }
        });
    }
    /**
     * Send a simple notification email
     */
    static sendEmail(_a) {
        return __awaiter(this, arguments, void 0, function* ({ to, subject, text, html, }) {
            try {
                const transporter = this.getTransporter();
                const mailOptions = {
                    from: process.env.GMAIL_USER,
                    to,
                    subject,
                    text,
                    html,
                };
                yield transporter.sendMail(mailOptions);
                this.log("info", `Notification email sent to ${to}`);
                return true;
            }
            catch (error) {
                this.log("error", `Failed to send notification email to ${to}:`, error);
                return false;
            }
        });
    }
    /**
     * Send a booking cancellation email to a user
     */
    static sendBookingCancellationEmail(_a) {
        return __awaiter(this, arguments, void 0, function* ({ to, userName, venueName, eventName, reason, refundInfo, managerPhone, }) {
            const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 32px;">
        <h2 style="color: #d32f2f;">Booking Cancelled</h2>
        <p>Dear <b>${userName}</b>,</p>
        <p>We regret to inform you that your booking for the venue <b>${venueName}</b> (event: <b>${eventName}</b>) has been <span style="color: #d32f2f; font-weight: bold;">cancelled</span> by the venue manager.</p>
        <p><b>Reason:</b> <span style="color: #333;">${reason}</span></p>
        ${refundInfo
                ? `<p style=\"color: #388e3c;\"><b>Refund Info:</b> ${refundInfo}</p>`
                : ""}
        ${managerPhone
                ? `<p><b>For more information, contact the venue manager at:</b> <a href='tel:${managerPhone}'>${managerPhone}</a></p>`
                : ""}
        <p>If you have any questions or need further assistance, please contact our support team.</p>
        <div style="margin-top: 32px; font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 16px;">
          Thank you for using our platform.<br/>
          <b>Giraffe Event System Team</b>
        </div>
      </div>
    `;
            return yield this.sendEmail({
                to,
                subject: `Your Booking for ${venueName} Has Been Cancelled`,
                html,
            });
        });
    }
}
exports.EmailService = EmailService;
EmailService.PASSWORD_LENGTH = 12;
EmailService.EXPIRY_HOURS = 24;
EmailService.SALT_ROUNDS = 10;
