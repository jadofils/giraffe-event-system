import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export class EmailService {
  /**
   * @deprecated Use sendTicketsEmail for multiple tickets or if you need a more structured single ticket email.
   */

  static async sendTicketsEmail({
    to,
    subject,
    eventName,
    eventDate,
    venueName,
    tickets,
    venueGoogleMapsLink,
  }: {
    to: string;
    subject: string;
    eventName: string;
    eventDate: Date;
    venueName: string;
    tickets: Array<{
      qrCodeUrl: string;
      attendeeName: string;
      ticketName: string;
      attendedDate: string;
      barcodeUrl: string; // Add barcode URL
      sevenDigitCode: string; // Add 7-digit code
      pdfUrl?: string; // Add pdfUrl to individual ticket object
    }>;
    venueGoogleMapsLink?: string;
    // pdfUrl?: string; // This is no longer needed, individual PDFs are on each ticket
  }): Promise<boolean> {
    try {
      const transporter = EmailService.getTransporter();

      const ticketHtml = tickets
        .map(
          (ticket) => `
          <div style="
            background: #ffffff;
            border: 2px solid #4285F4;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 4px 12px rgba(66, 133, 244, 0.1);
          ">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div style="
                background: linear-gradient(135deg, #4285F4 0%, #1a73e8 100%);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-weight: 600;
                margin-right: 12px;
              ">
                 ${ticket.ticketName}
              </div>
            </div>
            
            <div style="margin-bottom: 16px;">
              <p style="margin: 0 0 8px 0; color: #333; font-size: 16px;">
                <strong style="color: #4285F4;">👤 Attendee:</strong> ${
                  ticket.attendeeName
                }
              </p>
              <p style="margin: 0; color: #666; font-size: 14px;">
                <strong style="color: #4285F4;"> Valid Date:</strong> ${new Date(
                  ticket.attendedDate
                ).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            
            <div style="
              background: #f8f9ff;
              border-radius: 8px;
              padding: 16px;
              text-align: center;
              border: 1px dashed #4285F4;
            ">
              <p style="margin: 0 0 12px 0; color: #4285F4; font-weight: 600; font-size: 14px;">
                 SCAN AT ENTRANCE
              </p>
              <img src="${ticket.qrCodeUrl}" alt="QR Code for ${
            ticket.attendeeName
          }" 
                   style="
                     width: 120px; 
                     height: 120px; 
                     display: block; 
                     margin: 0 auto 10px;
                     border-radius: 8px;
                     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                   "/>
              <p style="margin: 0 0 12px 0; color: #4285F4; font-weight: 600; font-size: 14px;">
                 OR SCAN BARCODE
              </p>
              <img src="${ticket.barcodeUrl}" alt="Barcode for ${
            ticket.attendeeName
          }" 
                   style="
                     width: 180px; 
                     height: 60px; 
                     display: block; 
                     margin: 0 auto 10px;
                     border-radius: 8px;
                     box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                   "/>
              <p style="margin: 0 0 0px 0; color: #4285F4; font-weight: 600; font-size: 14px;">
                 OR ENTER CODE: <strong style="font-size: 16px;">${
                   ticket.sevenDigitCode
                 }</strong>
              </p>
              ${
                ticket.pdfUrl
                  ? `<div style="margin-top: 20px; ">
                      <a href="${ticket.pdfUrl}" style="
                        background: #1a73e8;
                        color: white;
                        padding: 8px 16px;
                        border-radius: 6px;
                        text-decoration: none;
                        font-weight: 600;
                        display: inline-block;
                        font-size: 12px;
                        box-shadow: 0 2px 8px rgba(26, 115, 232, 0.2);
                      ">
                        Download PDF Ticket
                      </a>
                    </div>`
                  : ""
              }
            </div>
          </div>
        `
        )
        .join("");

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Event Tickets - Giraffe Space</title>
    
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            
            <!-- Header -->
          <div style="
              background: linear-gradient(135deg, #347ff8ff 0%, #2a7eedff 100%);
              color: #FFFFFF;
              padding: 40px 30px;
              text-align: center;
              border-radius: 12px 12px 0 0;
            ">
              <img src="https://res.cloudinary.com/di5ntdtyl/image/upload/v1753886582/unnamed_1_qmgpg1.jpg" 
              alt="Giraffe Space Logo" style="
                display: block;
                margin: 0 auto 20px;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: rgba(255,255,255,0.1);
                padding: 12px;
              " />
              <h1 style="
                font-size: 28px;
                margin: 0;
                font-weight: 700;
                letter-spacing: -0.5px;
              ">
                 Your Event Tickets
              </h1>
              <p style="
                margin: 8px 0 0 0;
                opacity: 0.9;
                font-size: 16px;
              ">
                Ready for your amazing event!
              </p>
            </div>
          </div>

            <!-- Main Content -->
            <div style="padding: 32px 24px;">
              
              <!-- Event Info Card -->
              <div style="
                background: linear-gradient(135deg, #f8f9ff 0%, #e8f0fe 100%);
                border-radius: 12px;
                padding: 16px; /* Reduced padding */
                margin-bottom: 24px; /* Reduced margin-bottom */
                border-left: 4px solid #4285F4;
              ">
                <h2 style="
                  color: #1a73e8;
                  margin: 0 0 12px 0; /* Reduced margin-bottom for h2 */
                  font-size: 22px; /* Slightly reduced font size */
                  font-weight: 600;
                ">
                   ${eventName}
                </h2>
                
                <div style="gap: 12px;">
  <div style="min-width: 180px; margin-bottom: 12px;">
    <p style="margin: 0 0 6px 0; color: #333; font-size: 15px;">
      <strong style="color: #4285F4;">Event Date:</strong>
      <span style="font-size: 16px; font-weight: 600;">
        ${eventDate.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}
      </span>
    </p>
  </div>

  <div style="min-width: 180px;">
    <p style="margin: 0; color: #333; font-size: 15px;">
      <strong style="color: #4285F4;">Venue:</strong>
      <span style="font-size: 16px; font-weight: 600;">${venueName}</span>
      ${
        venueGoogleMapsLink
          ? `<br/>
             <a href="${venueGoogleMapsLink}" target="_blank" style="
               color: #4285F4;
               text-decoration: none;
               font-size: 13px;
               font-weight: 500;
             ">
               View on Google Maps →
             </a>`
          : ""
      }
    </p>
  </div>
</div>

              </div>

              <!-- Instructions -->
              <div style="
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 24px;
              ">
                <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 500;">
                   <strong>Important:</strong> Please save this email and present the QR codes below at the event entrance. Each ticket is valid only for its specified date.
                </p>
              </div>

              <!-- Tickets Section -->
              <h3 style="
                color: #1a73e8;
                margin: 0 0 20px 0;
                font-size: 20px;
                font-weight: 600;
                border-bottom: 2px solid #e8f0fe;
                padding-bottom: 8px;
              ">
                 Your Tickets (${tickets.length})
              </h3>
              
              ${ticketHtml}

              <!-- Support Section -->
              <div style="
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin-top: 32px;
                text-align: center;
                border: 1px solid #e9ecef;
              ">
                <h4 style="color: #4285F4; margin: 0 0 12px 0; font-size: 16px;">
                  Need Help? 
                </h4>
                <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
                  If you have any questions about your tickets or the event, please don't hesitate to contact our support team.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="
              background: #f8f9fa;
              padding: 24px;
              text-align: center;
              border-top: 1px solid #e9ecef;
            ">
              <div style="margin-bottom: 16px;">
                <img src="https://res.cloudinary.com/di5ntdtyl/image/upload/v1753886582/unnamed_1_qmgpg1.jpg" alt="Giraffe Space" style="
                  width: 40px;
                  height: 40px;
                  opacity: 0.7;
                "/>
              </div>
              <p style="
                margin: 0 0 8px 0;
                color: #666;
                font-size: 14px;
                font-weight: 600;
              ">
                Thank you for choosing Giraffe Space! 🦒
              </p>
              <p style="
                margin: 0;
                color: #999;
                font-size: 12px;
                line-height: 1.4;
              ">
                This email was sent by Giraffe Space Event Management System.<br/>
                Please keep this email for your records.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Giraffe Space Events" <${process.env.EMAIL_USER}>`,
        to,
        subject: ` ${subject} - Giraffe Space`,
        html: htmlContent,
        attachments: [
          {
            filename: "giraffe-logo.png",
            path: "https://res.cloudinary.com/di5ntdtyl/image/upload/v1753886582/unnamed_1_qmgpg1.jpg", // Adjust path as needed
            cid: "giraffe-logo",
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      console.log(
        `✅ Tickets email sent successfully to ${to} for ${tickets.length} tickets.`
      );
      return true;
    } catch (error) {
      console.error("❌ Error sending tickets email:", error);
      return false;
    }
  }

  public static readonly PASSWORD_LENGTH = 12;
  public static readonly EXPIRY_HOURS = 24;
  public static readonly SALT_ROUNDS = 10;

  public static log(
    level: "info" | "warn" | "error",
    message: string,
    ...meta: any[]
  ) {
    const prefix = level.toUpperCase();
    console[level](`${prefix}: ${message}`, ...meta);
  }

  public static generatePassword(length = this.PASSWORD_LENGTH): string {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from(
      { length },
      () => chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  }

  public static getTransporter() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      throw new Error("GMAIL credentials not configured");
    }

    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASSWORD,
      },
    });
  }
  public static generateWelcomeEmailContent(
    email: string,
    password: string,
    username: string,
    firstName: string,
    lastName: string
  ): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; 
            background: #f5f7fa; 
            color: #333333; 
            margin: 0;
            padding: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 30px auto; 
            background: #FFFFFF; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(66, 133, 244, 0.1); 
            overflow: hidden;
          }
          .header { 
            background: linear-gradient(135deg, #4285F4 0%, #1a73e8 100%); 
            color: #FFFFFF; 
            padding: 40px 30px; 
            text-align: center; 
          }
          .header h1 {
            font-size: 28px; 
            margin: 0;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 16px;
          }
          .logo { 
            display: block; 
            margin: 0 auto 20px; 
            width: 80px; 
            height: 80px;
            border-radius: 50%;
            background: rgba(255,255,255,0.1);
            padding: 12px;
          }
          .content {
            padding: 40px 30px;
          }
          .welcome-text {
            font-size: 18px;
            color: #333;
            margin-bottom: 24px;
            line-height: 1.6;
          }
          .credentials { 
            background: linear-gradient(135deg, #f8f9ff 0%, #e8f0fe 100%); 
            padding: 24px; 
            border: 2px solid #4285F4; 
            border-radius: 12px; 
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; 
            margin: 24px 0; 
            box-shadow: 0 2px 8px rgba(66, 133, 244, 0.1);
          }
          .credentials h3 {
            color: #1a73e8;
            margin: 0 0 16px 0;
            font-size: 16px;
            font-weight: 600;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          }
          .credential-item {
            margin: 12px 0;
            font-size: 14px;
            color: #333;
          }
          .credential-value {
            color: #1a73e8;
            font-weight: 600;
            background: rgba(66, 133, 244, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
          }
          .login-button { 
            display: inline-block; 
            background: linear-gradient(135deg, #4285F4 0%, #3182ebff 100%); 
            color: #FFFFFF; 
            padding: 14px 28px; 
            text-decoration: none; 
            border-radius: 8px; 
            font-weight: 600; 
            margin: 24px 0; 
            box-shadow: 0 4px 12px rgba(66, 133, 244, 0.3);
            transition: all 0.2s ease;
          }
          .login-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(66, 133, 244, 0.4);
          }
          .security-notice {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 16px;
            margin: 24px 0;
            color: #856404;
            font-size: 14px;
          }
          .footer { 
            background: #f8f9fa; 
            color: #666; 
            text-align: center; 
            padding: 24px 30px; 
            font-size: 14px; 
            border-top: 1px solid #e9ecef;
          }
          .footer-logo {
            width: 40px;
            height: 40px;
            opacity: 0.7;
            margin-bottom: 12px;
          }
          .footer a { 
            color: #4285F4; 
            text-decoration: none; 
            font-weight: 500;
          }
          .footer a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <img src="https://res.cloudinary.com/di5ntdtyl/image/upload/v1753886582/unnamed_1_qmgpg1.jpg" alt="Giraffe Space Logo" class="logo" />
            <h1> Welcome to Giraffe Space</h1>
            <p>Your account is ready to go!</p>
          </div>
          
          <div class="content">
            <div class="welcome-text">
              <h2 style="color: #1a73e8; margin: 0 0 16px 0;">Hello ${firstName} ${lastName}! </h2>
              <p>Welcome to <strong>Giraffe Space</strong> - your comprehensive event and venue management platform. Your account has been created successfully and you're ready to start managing events and venues!</p>
            </div>

            <div class="credentials">
              <h3>Your Login Credentials</h3>
              <div class="credential-item">
                <strong>Username:</strong> <span class="credential-value">${username}</span>
              </div>
              <div class="credential-item">
                <strong>First Name:</strong> <span class="credential-value">${firstName}</span>
              </div>
              <div class="credential-item">
                <strong>Last Name:</strong> <span class="credential-value">${lastName}</span>
              </div>
              <div class="credential-item">
                <strong>Email:</strong> <span class="credential-value">${email}</span>
              </div>
              <div class="credential-item">
                <strong>Temporary Password:</strong> <span class="credential-value">${password}</span>
              </div>
            </div>

            <div style="text-align: center; margin: 32px 0; color: #ffffff;">
              <a href="https://venue-and-event-management-front-si-tau.vercel.app/logindefaultpassword" class="login-button" style="color: #ffffff;">
                Login to Your Account
              </a>
            </div>

            <div class="security-notice">
              <strong>Security Notice:</strong> For your security, please change your password after your first login. Keep your credentials safe and never share them with anyone.
            </div>

            <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin-top: 32px;">
              <h4 style="color: #4285F4; margin: 0 0 12px 0; font-size: 16px;"> Need Help Getting Started?</h4>
              <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
                Our support team is here to help you make the most of Giraffe Space. Don't hesitate to reach out if you have any questions!
              </p>
            </div>
          </div>

          <div class="footer">
            <img src="https://res.cloudinary.com/di5ntdtyl/image/upload/v1753886582/unnamed_1_qmgpg1.jpg" alt="Giraffe Space" class="footer-logo" />
            <p style="margin: 0 0 8px 0; font-weight: 600;">
              Thank you for choosing Giraffe Space! 🦒
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.4;">
              © ${new Date().getFullYear()} Giraffe Space. All rights reserved.<br/>
              Need help? <a href="mailto:support@giraffespace.com">Contact Support</a>
            </p>
          </div>
        </div>
      </body>
      </html>`;
  }

  public static generateResetEmailContent(
    resetLink: string,
    username: string
  ): string {
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

  public static async sendPasswordResetEmail(
    email: string,
    resetLink: string,
    username: string
  ): Promise<void> {
    try {
      const transporter = this.getTransporter();

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: "Reset Your University of Rwanda Password",
        html: this.generateResetEmailContent(resetLink, username),
      };

      await transporter.sendMail(mailOptions);
      this.log("info", `Password reset email sent to ${email}`);
    } catch (error) {
      this.log(
        "error",
        `Failed to send password reset email to ${email}:`,
        error
      );
      throw error;
    }
  }

  public static async sendDefaultPasswordWithPassword(
    email: string,
    lastName: string,
    firstName: string,
    username: string,
    password: string
  ): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: `Giraffe Space Login Credentials`,
        html: this.generateWelcomeEmailContent(
          email,
          password,
          username,
          firstName,
          lastName
        ),
      };
      this.log("info", `Sending welcome email to ${email}`);
      const info = await transporter.sendMail(mailOptions);
      this.log("info", "Welcome email sent successfully:", info.response);
      return true;
    } catch (error) {
      this.log("error", "Error in sendDefaultPasswordWithPassword:", error);
      return false;
    }
  }

  public static async sendSuccessPasswordForgetEmail(
    email: string,
    username: string
  ): Promise<void> {
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

      await transporter.sendMail(mailOptions);
      this.log("info", `Password reset success email sent to ${email}`);
    } catch (error) {
      this.log(
        "error",
        `Failed to send password reset success email to ${email}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Send a simple notification email
   */
  public static async sendEmail({
    to,
    subject,
    text,
    html,
  }: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<boolean> {
    try {
      const transporter = this.getTransporter();
      const mailOptions = {
        from: process.env.GMAIL_USER,
        to,
        subject,
        text,
        html,
      };
      await transporter.sendMail(mailOptions);
      this.log("info", `Notification email sent to ${to}`);
      return true;
    } catch (error) {
      this.log("error", `Failed to send notification email to ${to}:`, error);
      return false;
    }
  }

  /**
   * Send a booking cancellation email to a user
   */
  public static async sendBookingCancellationEmail({
    to,
    userName,
    venueName,
    eventName,
    reason,
    refundInfo,
    managerPhone,
  }: {
    to: string;
    userName: string;
    venueName: string;
    eventName: string;
    reason: string;
    refundInfo?: string;
    managerPhone?: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #eee; padding: 32px;">
        <h2 style="color: #d32f2f;">Booking Cancelled</h2>
        <p>Dear <b>${userName}</b>,</p>
        <p>We regret to inform you that your booking for the venue <b>${venueName}</b> (event: <b>${eventName}</b>) has been <span style="color: #d32f2f; font-weight: bold;">cancelled</span> by the venue manager.</p>
        <p><b>Reason:</b> <span style="color: #333;">${reason}</span></p>
        ${
          refundInfo
            ? `<p style=\"color: #388e3c;\"><b>Refund Info:</b> ${refundInfo}</p>`
            : ""
        }
        ${
          managerPhone
            ? `<p><b>For more information, contact the venue manager at:</b> <a href='tel:${managerPhone}'>${managerPhone}</a></p>`
            : ""
        }
        <p>If you have any questions or need further assistance, please contact our support team.</p>
        <div style="margin-top: 32px; font-size: 13px; color: #888; border-top: 1px solid #eee; padding-top: 16px;">
          Thank you for using our platform.<br/>
          <b>Giraffe Event System Team</b>
        </div>
      </div>
    `;
    return await this.sendEmail({
      to,
      subject: `Your Booking for ${venueName} Has Been Cancelled`,
      html,
    });
  }

  static async sendFreeEventInvitationEmail({
    to,
    subject,
    eventName,
    eventDate,
    venueName,
    attendeeName,
    qrCodeUrl,
    barcodeUrl,
    sevenDigitCode,
    venueGoogleMapsLink,
    startTime,
    endTime,
  }: {
    to: string;
    subject: string;
    eventName: string;
    eventDate: Date;
    venueName: string;
    attendeeName: string;
    qrCodeUrl: string;
    barcodeUrl: string;
    sevenDigitCode: string;
    venueGoogleMapsLink?: string;
    startTime?: string;
    endTime?: string;
  }): Promise<boolean> {
    try {
      const transporter = EmailService.getTransporter();

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your Event Invitation - Giraffe Space</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff;">
            
            <!-- Header -->
            <div style="
              background: linear-gradient(135deg, #347ff8ff 0%, #2a7eedff 100%);
              color: #FFFFFF;
              padding: 40px 30px;
              text-align: center;
              border-radius: 12px 12px 0 0;
            ">
              <img src="https://res.cloudinary.com/di5ntdtyl/image/upload/v1753886582/unnamed_1_qmgpg1.jpg" 
              alt="Giraffe Space Logo" style="
                display: block;
                margin: 0 auto 20px;
                width: 80px;
                height: 80px;
                border-radius: 50%;
                background: rgba(255,255,255,0.1);
                padding: 12px;
              " />
              <h1 style="
                font-size: 28px;
                margin: 0;
                font-weight: 700;
                letter-spacing: -0.5px;
              ">
                 Your Event Invitation
              </h1>
              <p style="
                margin: 8px 0 0 0;
                opacity: 0.9;
                font-size: 16px;
              ">
                We look forward to seeing you there!
              </p>
            </div>

            <!-- Main Content -->
            <div style="padding: 32px 24px;">
              
              <!-- Event Info Card -->
              <div style="
                background: linear-gradient(135deg, #f8f9ff 0%, #e8f0fe 100%);
                border-radius: 12px;
                padding: 16px;
                margin-bottom: 24px;
                border-left: 4px solid #4285F4;
              ">
                <h2 style="
                  color: #1a73e8;
                  margin: 0 0 12px 0;
                  font-size: 22px;
                  font-weight: 600;
                ">
                   ${eventName}
                </h2>
                
                <div style="gap: 12px;">
                  <div style="min-width: 180px; margin-bottom: 12px;">
                    <p style="margin: 0 0 6px 0; color: #333; font-size: 15px;">
                      <strong style="color: #4285F4;">👤 Attendee:</strong> ${attendeeName}
                    </p>
                    <p style="margin: 0 0 6px 0; color: #333; font-size: 15px;">
                      <strong style="color: #4285F4;">Event Date:</strong>
                      <span style="font-size: 16px; font-weight: 600;">
                        ${eventDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </span>
                    </p>
                    ${
                      startTime && endTime
                        ? `<p style="margin: 0 0 6px 0; color: #333; font-size: 15px;">
                            <strong style="color: #4285F4;">Time:</strong>
                            <span style="font-size: 16px; font-weight: 600;">${startTime} - ${endTime}</span>
                          </p>`
                        : ""
                    }
                  </div>

                  <div style="min-width: 180px;">
                    <p style="margin: 0; color: #333; font-size: 15px;">
                      <strong style="color: #4285F4;">Venue:</strong>
                      <span style="font-size: 16px; font-weight: 600;">${venueName}</span>
                      ${
                        venueGoogleMapsLink
                          ? `<br/>
                             <a href="${venueGoogleMapsLink}" target="_blank" style="
                               color: #4285F4;
                               text-decoration: none;
                               font-size: 13px;
                               font-weight: 500;
                             ">
                               View on Google Maps →
                             </a>`
                          : ""
                      }
                    </p>
                  </div>
                </div>
              </div>

              <!-- Instructions -->
              <div style="
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 24px;
              ">
                <p style="margin: 0; color: #856404; font-size: 14px; font-weight: 500;">
                   <strong>Important:</strong> Please save this email and present the QR code/barcode/7-digit code below at the event entrance.
                </p>
              </div>

              <!-- Codes Section -->
              <h3 style="
                color: #1a73e8;
                margin: 0 0 20px 0;
                font-size: 20px;
                font-weight: 600;
                border-bottom: 2px solid #e8f0fe;
                padding-bottom: 8px;
              ">
                 Your Entry Codes
              </h3>
              
              <div style="
                background: #f8f9ff;
                border-radius: 8px;
                padding: 24px;
                text-align: center;
                border: 1px dashed #4285F4;
              ">
                <p style="margin: 0 0 12px 0; color: #4285F4; font-weight: 600; font-size: 14px;">
                   SCAN AT ENTRANCE
                </p>
                <img src="${qrCodeUrl}" alt="QR Code for ${attendeeName}" 
                     style="
                       width: 120px; 
                       height: 120px; 
                       display: block; 
                       margin: 0 auto 10px;
                       border-radius: 8px;
                       box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                     "/>
                <p style="margin: 0 0 12px 0; color: #4285F4; font-weight: 600; font-size: 14px;">
                   OR SCAN BARCODE
                </p>
                <img src="${barcodeUrl}" alt="Barcode for ${attendeeName}" 
                     style="
                       width: 180px; 
                       height: 60px; 
                       display: block; 
                       margin: 0 auto 10px;
                       border-radius: 8px;
                       box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                     "/>
                <p style="margin: 0 0 0px 0; color: #4285F4; font-weight: 600; font-size: 14px;">
                   OR ENTER CODE: <strong style="font-size: 16px;">${sevenDigitCode}</strong>
                </p>
              </div>

              <!-- Support Section -->
              <div style="
                background: #f8f9fa;
                border-radius: 8px;
                padding: 20px;
                margin-top: 32px;
                text-align: center;
                border: 1px solid #e9ecef;
              ">
                <h4 style="color: #4285F4; margin: 0 0 12px 0; font-size: 16px;">
                  Need Help? 
                </h4>
                <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
                  If you have any questions about the event or your entry, please don't hesitate to contact our support team.
                </p>
              </div>
            </div>

            <!-- Footer -->
            <div style="
              background: #f8f9fa;
              padding: 24px;
              text-align: center;
              border-top: 1px solid #e9ecef;
            ">
              <div style="margin-bottom: 16px;">
                <img src="https://res.cloudinary.com/di5ntdtyl/image/upload/v1753886582/unnamed_1_qmgpg1.jpg" alt="Giraffe Space" style="
                  width: 40px;
                  height: 40px;
                  opacity: 0.7;
                "/>
              </div>
              <p style="
                margin: 0 0 8px 0;
                color: #666;
                font-size: 14px;
                font-weight: 600;
              ">
                Thank you for choosing Giraffe Space! 🦒
              </p>
              <p style="
                margin: 0;
                color: #999;
                font-size: 12px;
                line-height: 1.4;
              ">
                This email was sent by Giraffe Space Event Management System.<br/>
                Please keep this email for your records.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Giraffe Space Events" <${process.env.EMAIL_USER}>`,
        to,
        subject: `${subject} - Giraffe Space`,
        html: htmlContent,
        attachments: [
          {
            filename: "giraffe-logo.png",
            path: "https://res.cloudinary.com/di5ntdtyl/image/upload/v1753886582/unnamed_1_qmgpg1.jpg", // Adjust path as needed
            cid: "giraffe-logo",
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      console.log(
        `✅ Free event invitation email sent successfully to ${to} for event ${eventName}.`
      );
      return true;
    } catch (error) {
      console.error("❌ Error sending free event invitation email:", error);
      return false;
    }
  }
}
