interface UploadResult {
    success: boolean;
    url?: string;
    error?: string;
}
interface JsonUploadResult extends UploadResult {
    key?: string;
}
declare class AwsS3Service {
    static serviceType: string;
    private s3Client;
    private bucket;
    private fileUploadPath;
    private runtime;
    initialize(runtime: any): Promise<void>;
    private initializeS3Client;
    uploadFile(filePath: string, subDirectory?: string, useSignedUrl?: boolean, expiresIn?: number): Promise<UploadResult>;
    generateSignedUrl(fileName: string, expiresIn?: number): Promise<string>;
    private getContentType;
    /**
     * Upload JSON object to S3
     * @param jsonData JSON data to upload
     * @param fileName File name (optional, without path)
     * @param subDirectory Subdirectory (optional)
     * @param useSignedUrl Whether to use signed URL
     * @param expiresIn Signed URL expiration time (seconds)
     */
    uploadJson(jsonData: any, fileName?: string, subDirectory?: string, useSignedUrl?: boolean, expiresIn?: number): Promise<JsonUploadResult>;
}

declare const awsPlugin: {
    name: string;
    description: string;
    services: AwsS3Service[];
    actions: never[];
};

export { awsPlugin, awsPlugin as default };
