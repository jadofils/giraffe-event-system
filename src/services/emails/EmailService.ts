import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

class PasswordService {
  static async sendTicketEmail({
    to,
    subject,
    eventName,
    eventDate,
    venueName,
    ticketPdf,
    qrCode
  }: {
    to: string;
    subject: string;
    eventName: string;
    eventDate: Date;
    venueName: string;
    ticketPdf: Buffer;
    qrCode?: string;
  }): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
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
          ${qrCode ? `<img src="${qrCode}" alt="QR Code" width="150"/>` : ''}
          <p>Thank you for booking with us!</p>
        `,
        attachments: [
          {
            filename: `${eventName}_Ticket.pdf`,
            content: ticketPdf,
            contentType: 'application/pdf'
          }
        ]
      };

      await transporter.sendMail(mailOptions);
      console.log(`Ticket email sent successfully to ${to}`);
      return true;
    } catch (error) {
      console.error('Error sending ticket email:', error);
      return false;
    }
  }

  public static readonly PASSWORD_LENGTH = 12;
  public static readonly EXPIRY_HOURS = 24;
  public static readonly SALT_ROUNDS = 10;

  public static log(level: 'info' | 'warn' | 'error', message: string, ...meta: any[]) {
    const prefix = level.toUpperCase();
    console[level](`${prefix}: ${message}`, ...meta);
  }

  public static generatePassword(length = this.PASSWORD_LENGTH): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  public static getTransporter() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_PASSWORD) {
      throw new Error('GMAIL credentials not configured');
    }

    return nodemailer.createTransport({
      service: 'gmail',
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
<img src="https://www.ur.ac.rw/IMG/logo/logo_ur.jpg" alt="University of Rwanda Logo" class="logo" />
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


  public static generateResetEmailContent(resetLink: string, username: string): string {
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

  public static async sendPasswordResetEmail(email: string, resetLink: string, username: string): Promise<void> {
    try {
      const transporter = this.getTransporter();

      const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: 'Reset Your University of Rwanda Password',
        html: this.generateResetEmailContent(resetLink, username),
      };

      await transporter.sendMail(mailOptions);
      this.log('info', `Password reset email sent to ${email}`);
    } catch (error) {
      this.log('error', `Failed to send password reset email to ${email}:`, error);
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
        subject: `Your Temporary University of Rwanda Login Credentials (Valid for ${this.EXPIRY_HOURS} Hours)`,
        html: this.generateWelcomeEmailContent(email, password, username, firstName, lastName),
      };
      this.log('info', `Sending welcome email to ${email}`);
      const info = await transporter.sendMail(mailOptions);
      this.log('info', 'Welcome email sent successfully:', info.response);
      return true;
    } catch (error) {
      this.log('error', 'Error in sendDefaultPasswordWithPassword:', error);
      return false;
    }
  }

  public static async sendSuccessPasswordForgetEmail(email: string, username: string): Promise<void> {
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
      <a href="https://your-app-url.vercel.app/login" class="button">Login to Your Account</a>
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
        subject: 'Your University of Rwanda Password Has Been Changed',
        html: emailContent,
      };

      await transporter.sendMail(mailOptions);
      this.log('info', `Password reset success email sent to ${email}`);
    } catch (error) {
      this.log('error', `Failed to send password reset success email to ${email}:`, error);
      throw error;
    }
  }
}

export default PasswordService;