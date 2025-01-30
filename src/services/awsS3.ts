
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import * as fs from "node:fs";
import * as path from "node:path";

interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

interface JsonUploadResult extends UploadResult {
    key?: string;
}

export class AwsS3Service {
    static serviceType = "AWS_S3";

    private s3Client: S3Client | null = null;
    private bucket = "";
    private fileUploadPath = "";
    private runtime: any = null;

    async initialize(runtime:any): Promise<void> {
        this.runtime = runtime;
        this.fileUploadPath = runtime.getSetting("AWS_S3_UPLOAD_PATH") ?? "";
    }

    private async initializeS3Client(): Promise<boolean> {
        if (this.s3Client) return true;
        if (!this.runtime) return false;

        const AWS_ACCESS_KEY_ID = this.runtime.getSetting("AWS_ACCESS_KEY_ID");
        const AWS_SECRET_ACCESS_KEY = this.runtime.getSetting(
            "AWS_SECRET_ACCESS_KEY",
        );
        const AWS_REGION = this.runtime.getSetting("AWS_REGION");
        const AWS_S3_BUCKET = this.runtime.getSetting("AWS_S3_BUCKET");

        if (
            !AWS_ACCESS_KEY_ID ||
            !AWS_SECRET_ACCESS_KEY ||
            !AWS_REGION ||
            !AWS_S3_BUCKET
        ) {
            return false;
        }

        const endpoint = this.runtime.getSetting("AWS_S3_ENDPOINT");
        const sslEnabled = this.runtime.getSetting("AWS_S3_SSL_ENABLED");
        const forcePathStyle = this.runtime.getSetting(
            "AWS_S3_FORCE_PATH_STYLE",
        );

        this.s3Client = new S3Client({
            ...(endpoint ? { endpoint } : {}),
            ...(sslEnabled ? { sslEnabled } : {}),
            ...(forcePathStyle
                ? { forcePathStyle: Boolean(forcePathStyle) }
                : {}),
            region: AWS_REGION,
            credentials: {
                accessKeyId: AWS_ACCESS_KEY_ID,
                secretAccessKey: AWS_SECRET_ACCESS_KEY,
            },
        });
        this.bucket = AWS_S3_BUCKET;
        return true;
    }

    async uploadFile(
        filePath: string,
        subDirectory = "",
        useSignedUrl = false,
        expiresIn = 900,
    ): Promise<UploadResult> {
        try {
            if (!(await this.initializeS3Client())) {
                return {
                    success: false,
                    error: "AWS S3 credentials not configured",
                };
            }

            if (!this.s3Client) {
                return {
                    success: false,
                    error: "S3 client not initialized",
                };
            }

            if (!fs.existsSync(filePath)) {
                return {
                    success: false,
                    error: "File does not exist",
                };
            }

            const fileContent = fs.readFileSync(filePath);
            const baseFileName = `${Date.now()}-${path.basename(filePath)}`;
            
            // Use split/join instead of replaceAll for better compatibility
            const fileName = `${this.fileUploadPath}${subDirectory}/${baseFileName}`.split("//").join("/");
            
            const uploadParams = {
                Bucket: this.bucket,
                Key: fileName,
                Body: fileContent,
                ContentType: this.getContentType(filePath),
            };

            await this.s3Client.send(new PutObjectCommand(uploadParams));

            const result: UploadResult = {
                success: true,
            };

            if (!useSignedUrl) {
                const s3Config = this.s3Client.config;
                if (s3Config.endpoint) {
                    const endpoint = await s3Config.endpoint();
                    const port = endpoint.port ? `:${endpoint.port}` : "";
                    result.url = `${endpoint.protocol}//${endpoint.hostname}${port}${endpoint.path}${this.bucket}/${fileName}`;
                } else {
                    result.url = `https://${this.bucket}.s3.${this.runtime?.getSetting("AWS_REGION")}.amazonaws.com/${fileName}`;
                }
            } else {
                const getObjectCommand = new GetObjectCommand({
                    Bucket: this.bucket,
                    Key: fileName,
                });
                result.url = await getSignedUrl(
                    this.s3Client,
                    getObjectCommand,
                    {
                        expiresIn,
                    },
                );
            }

            return result;
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown error occurred",
            };
        }
    }

    async generateSignedUrl(
        fileName: string,
        expiresIn = 900,
    ): Promise<string> {
        if (!(await this.initializeS3Client())) {
            throw new Error("AWS S3 credentials not configured");
        }

        if (!this.s3Client) {
            throw new Error("S3 client not initialized");
        }

        const command = new GetObjectCommand({
            Bucket: this.bucket,
            Key: fileName,
        });

        return await getSignedUrl(this.s3Client, command, { expiresIn });
    }

    private getContentType(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const contentTypes: { [key: string]: string } = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
        };
        return contentTypes[ext] || "application/octet-stream";
    }

    /**
     * Upload JSON object to S3
     * @param jsonData JSON data to upload
     * @param fileName File name (optional, without path)
     * @param subDirectory Subdirectory (optional)
     * @param useSignedUrl Whether to use signed URL
     * @param expiresIn Signed URL expiration time (seconds)
     */
    async uploadJson(
        jsonData: any,
        fileName?: string,
        subDirectory?: string,
        useSignedUrl = false,
        expiresIn = 900,
    ): Promise<JsonUploadResult> {
        try {
            if (!(await this.initializeS3Client())) {
                return {
                    success: false,
                    error: "AWS S3 credentials not configured",
                };
            }

            if (!this.s3Client) {
                return {
                    success: false,
                    error: "S3 client not initialized",
                };
            }

            if (!jsonData) {
                return {
                    success: false,
                    error: "JSON data is required",
                };
            }

            const timestamp = Date.now();
            const actualFileName = fileName || `${timestamp}.json`;

            let fullPath = this.fileUploadPath || "";
            if (subDirectory) {
                fullPath = `${fullPath}/${subDirectory}`.split(/\/+/).join("/");
            }
            const key = `${fullPath}/${actualFileName}`.split(/\/+/).join("/");

            const jsonString = JSON.stringify(jsonData, null, 2);

            const uploadParams = {
                Bucket: this.bucket,
                Key: key,
                Body: jsonString,
                ContentType: "application/json",
            };

            await this.s3Client.send(new PutObjectCommand(uploadParams));

            const result: JsonUploadResult = {
                success: true,
                key: key,
            };

            if (!useSignedUrl) {
                const s3Config = this.s3Client.config;
                if (s3Config.endpoint) {
                    const endpoint = await s3Config.endpoint();
                    const port = endpoint.port ? `:${endpoint.port}` : "";
                    result.url = `${endpoint.protocol}//${endpoint.hostname}${port}${endpoint.path}${this.bucket}/${key}`;
                } else {
                    result.url = `https://${this.bucket}.s3.${this.runtime?.getSetting("AWS_REGION")}.amazonaws.com/${key}`;
                }
            } else {
                const getObjectCommand = new GetObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                });
                result.url = await getSignedUrl(
                    this.s3Client,
                    getObjectCommand,
                    { expiresIn },
                );
            }

            return result;
        } catch (error) {
            return {
                success: false,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown error occurred",
            };
        }
    }
}

export default AwsS3Service;
