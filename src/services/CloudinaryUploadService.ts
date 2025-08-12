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
    fileName?: string,
    resourceType: "image" | "video" | "raw" | "auto" = "auto" // Add resourceType parameter
  ): Promise<{ url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: fileName,
          resource_type: resourceType, // Use the passed resourceType
        },
        (error: any, result: any) => {
          if (error) return reject(error);
          console.log(
            "Cloudinary upload result for:",
            fileName,
            "Resource Type:",
            resourceType,
            "Result:",
            result
          ); // ADD THIS LOG
          resolve({ url: result.secure_url, public_id: result.public_id });
        }
      );
      streamifier.createReadStream(fileBuffer).pipe(uploadStream);
    });
  }

  static extractCloudinaryPublicId(
    url: string,
    resourceType: "image" | "video" | "raw" | "auto"
  ): string {
    // Remove query params and fragments
    let cleanUrl = url.split("?")[0].split("#")[0];
    // Find the part after '/upload/'
    const uploadIndex = cleanUrl.indexOf("/upload/");
    if (uploadIndex === -1) return "";
    let publicId = cleanUrl.substring(uploadIndex + 8); // after '/upload/'

    // Remove version (v1234567/) if present
    const versionMatch = publicId.match(/^(v\d+\/)(.*)/);
    if (versionMatch) {
      publicId = versionMatch[2];
    }

    // Remove file extension, but only for image/video types (not raw)
    if (resourceType !== "raw") {
      publicId = publicId.replace(/\.[^/.]+$/, "");
    }

    return publicId;
  }

  static async deleteFromCloudinary(
    url: string,
    resourceType: "image" | "video" | "raw" = "image"
  ): Promise<void> {
    if (!url) {
      console.warn("No URL provided for Cloudinary deletion.");
      return;
    }

    try {
      // console.log("=== DEBUGGING CLOUDINARY DELETE ==="); // REMOVE THIS LOG
      // console.log("Original URL:", url); // REMOVE THIS LOG

      // Use the new robust public_id extraction
      const publicId = CloudinaryUploadService.extractCloudinaryPublicId(
        url,
        resourceType
      ); // Pass resourceType
      // console.log("Extracted public_id:", publicId); // REMOVE THIS LOG
      if (!publicId) {
        console.error("Could not extract public_id from URL", url);
        return;
      }

      let result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      // console.log(`Delete result for "${publicId}" [${resourceType}]:`, result); // REMOVE THIS LOG
      if (result.result === "ok") {
        console.log(`✅ Successfully deleted with public_id: "${publicId}"`);
      } else if (result.result === "not found" && resourceType === "raw") {
        // Try as image just in case (fallback for miscategorized files)
        // console.log(`File not found as 'raw', trying as 'image'...`); // REMOVE THIS LOG
        result = await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
        });
        // console.log(`Delete result for "${publicId}" [image]:`, result); // REMOVE THIS LOG
        if (result.result === "ok") {
          console.log(
            `✅ Successfully deleted with public_id: "${publicId}" as image`
          );
        } else {
          console.log(`File not found with public_id: "${publicId}" as image`);
        }
      } else if (result.result === "not found" && resourceType === "image") {
        // Try as raw just in case (fallback for miscategorized files)
        // console.log(`File not found as 'image', trying as 'raw'...`); // REMOVE THIS LOG
        result = await cloudinary.uploader.destroy(publicId, {
          resource_type: "raw",
        });
        // console.log(`Delete result for "${publicId}" [raw]:`, result); // REMOVE THIS LOG
        if (result.result === "ok") {
          console.log(
            `✅ Successfully deleted with public_id: "${publicId}" as raw`
          );
        } else {
          console.log(`File not found with public_id: "${publicId}" as raw`);
        }
      } else if (result.result === "not found") {
        console.log(`File not found with public_id: "${publicId}"`);
      } else {
        console.log("❌ Failed to delete with public_id", publicId);
      }
      // console.log("=== END DEBUGGING ==="); // REMOVE THIS LOG
    } catch (err) {
      console.error("Cloudinary delete error:", err, "URL:", url);
      throw err;
    }
  }
}
