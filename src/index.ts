import {
    AwsS3Service,
} from "./services/awsS3"

export const awsPlugin = {
    name: "default",
    description: "Default plugin, with basic actions and evaluators",
    services: [
        new AwsS3Service() as any,
    ],
    actions: [],
};

export default awsPlugin;