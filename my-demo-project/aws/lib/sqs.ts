import {Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {IQueue, Queue} from "aws-cdk-lib/aws-sqs";

interface SQStackProps extends StackProps {
    appName: string;
    appEnv: string;
}

export class SQSStack extends Stack {
    readonly highPriorityQueue: IQueue;
    readonly lowPriorityQueue: IQueue;
    readonly failQueue: IQueue;

    constructor(scope: Construct, id: string, props: SQStackProps) {
        super(scope, id, props);

        const appId = `${props.appName}-${props.appEnv}`;
        const appSlug = appId.toLowerCase();

        this.highPriorityQueue = new Queue(this, `highPriorityQueue`, {
            queueName: `${appSlug}-messages-high-priority`,
            visibilityTimeout: Duration.hours(1)
        });

        this.lowPriorityQueue = new Queue(this, `lowPriorityQueue`, {
            queueName: `${appSlug}-messages-low-priority`,
            visibilityTimeout: Duration.hours(1)
        });

        this.failQueue = new Queue(this, `failQueue`, {
            queueName: `${appSlug}-messages-failed`,
            visibilityTimeout: Duration.hours(1),
        });
    }
}