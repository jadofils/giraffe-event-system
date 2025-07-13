import cloudinary from "../config/cloudinary";
import streamifier from "streamifier";

export class CloudinaryUploadService {
  /**
   * Uploads a file buffer to Cloudinary and returns the URL.
   * @param fileBuffer The file buffer to upload.
   * @param folder Optional folder in Cloudinary.
   * @param fileName Optional file name (public_id) in Cloudinary.
   * @returns The Cloudinary upload result (including URL).
   */
  static async uploadBuffer(
    fileBuffer: Buffer,
    folder?: string,
    fileName?: string
  ): Promise<{ url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: fileName,
          resource_type: "auto",
        },
        (error: any, result: any) => {
          if (error) return reject(error);
          resolve({ url: result.secure_url, public_id: result.public_id });
        }
      );
      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  }
}
