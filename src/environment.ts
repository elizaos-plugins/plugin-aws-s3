import type { IAgentRuntime } from "@elizaos/core";
import { z } from "zod";

export const nodeEnvSchema = z.object({
    // AWS Configuration
    AWS_ACCESS_KEY_ID: z.string(),
    AWS_SECRET_ACCESS_KEY: z.string(),
    AWS_REGION: z.string(),
    AWS_S3_BUCKET: z.string().optional(),
    AWS_S3_UPLOAD_PATH: z.string().optional(),
    AWS_S3_ENDPOINT: z.string().optional(),
    AWS_S3_SSL_ENABLED: z.string().transform((val) => val === 'true').optional(),
    AWS_S3_FORCE_PATH_STYLE: z.string().transform((val) => val === 'true').optional(),
});

export type NodeConfig = z.infer<typeof nodeEnvSchema>;

export async function validateNodeConfig(
    runtime: IAgentRuntime
): Promise<NodeConfig> {
    try {
        const config = {
            // AWS settings (only include if present)
            ...(runtime.getSetting("AWS_ACCESS_KEY_ID") && {
                AWS_ACCESS_KEY_ID: runtime.getSetting("AWS_ACCESS_KEY_ID"),
                AWS_SECRET_ACCESS_KEY: runtime.getSetting("AWS_SECRET_ACCESS_KEY"),
                AWS_REGION: runtime.getSetting("AWS_REGION"),
                AWS_S3_BUCKET: runtime.getSetting("AWS_S3_BUCKET"),
                AWS_S3_UPLOAD_PATH: runtime.getSetting("AWS_S3_UPLOAD_PATH"),
                AWS_S3_ENDPOINT: runtime.getSetting("AWS_S3_ENDPOINT"),
                AWS_S3_SSL_ENABLED: runtime.getSetting("AWS_S3_SSL_ENABLED"),
                AWS_S3_FORCE_PATH_STYLE: runtime.getSetting("AWS_S3_FORCE_PATH_STYLE"),
            }),
        };

        return nodeEnvSchema.parse(config);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errorMessages = error.errors
                .map((err) => `${err.path.join(".")}: ${err.message}`)
                .join("\n");
            throw new Error(
                `Node configuration validation failed:\n${errorMessages}`
            );
        }
        throw error;
    }
}
