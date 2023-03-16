import {CfnOutput, Duration, Stack, StackProps} from 'aws-cdk-lib';
import {Port, SecurityGroup, Vpc} from 'aws-cdk-lib/aws-ec2';
import {
    CapacityProviderStrategy,
    Cluster,
    Compatibility,
    ContainerImage,
    FargateService,
    LogDrivers,
    NetworkMode,
    Protocol as EcsProtocol,
    Secret as EcsSecret,
    TaskDefinition,
} from 'aws-cdk-lib/aws-ecs';
import {
    ApplicationListener,
    ApplicationLoadBalancer,
    ApplicationProtocol,
    ApplicationTargetGroup,
    ListenerCondition,
    Protocol,
    TargetType
} from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {CfnAccessKey, ManagedPolicy, Role, ServicePrincipal, User} from 'aws-cdk-lib/aws-iam';
import {ARecord, HostedZone, RecordTarget} from 'aws-cdk-lib/aws-route53';
import {LoadBalancerTarget} from 'aws-cdk-lib/aws-route53-targets';
import {ISecret, Secret} from 'aws-cdk-lib/aws-secretsmanager';
import {Construct} from 'constructs';
import {IRepository} from "aws-cdk-lib/aws-ecr";
import {BlockPublicAccess, Bucket} from "aws-cdk-lib/aws-s3";
import {IQueue} from "aws-cdk-lib/aws-sqs";

interface AppContainerProps {
    repository: IRepository
    environment: { [key: string]: string }
    memoryReservationMiB: number
}

export default interface AppStackProps extends StackProps {
    appName: string
    appEnv: string
    appVersion: string
    vpcName: string
    appSubDomainName: string
    domain: string
    database: {
        name: string
        version: string
    }
    secret: {
        app: string
        database: string
    }
    loadBalancer: {
        arn: string
        listener: {
            arn: string
            priority: number
        }
    }
    // TODO: ADDQUEUE
    // queue: {
    //     highPriorityQueue: IQueue,
    //     lowPriorityQueue: IQueue,
    //     failQueue: IQueue,
    // },
    cluster: {
        services: {
            api: {
                capacityProviderConfig: CapacityProviderStrategy[]
                taskDefinition: {
                    cpu: string
                    memory: string
                    container: {
                        nginx: AppContainerProps
                        php_fpm: AppContainerProps
                        supervisor: AppContainerProps
                    }
                },
                desiredCount: number
            }
        }
    }
}

export class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppStackProps) {
        super(scope, id, props);

        const appId = `${props.appName}-${props.appEnv}`;
        const appSlug = appId.toLowerCase();

        const vpc = Vpc.fromLookup(this, `${appId}-Vpc`, { vpcName: props.vpcName });

        const loadBalancer = ApplicationLoadBalancer.fromLookup(this, `${appId}-LoadBalancer`, {
            loadBalancerArn: props.loadBalancer.arn,
        });

        const applicationTargetGroup = new ApplicationTargetGroup(
            this,
            `${appId}-Target`,
            {
                targetGroupName: `${appSlug}-target`,
                port: 80,
                vpc,
                protocol: ApplicationProtocol.HTTP,
                targetType: TargetType.IP,
                deregistrationDelay: Duration.seconds(5),
                healthCheck: {
                    path: "/ping",
                    protocol: Protocol.HTTP,
                    interval: Duration.seconds(5),
                    timeout: Duration.seconds(2),
                    healthyThresholdCount: 2,
                    unhealthyThresholdCount: 2,
                },
            }
        );

        const listener = ApplicationListener.fromLookup(this, `${appId}-LoadBalancer-Listener`, {
            listenerArn: props.loadBalancer.listener.arn,
        })

        listener.addTargetGroups(`${appId}-Target-Group`, {
            priority: props.loadBalancer.listener.priority,
            conditions: [
                ListenerCondition.httpRequestMethods(['GET', 'POST']),
            ],
            targetGroups: [applicationTargetGroup],
        });

        const ecsSecurityGroup = new SecurityGroup(this, `${appId}-Ecs-SecurityGroup`, {
            securityGroupName: `${appSlug}-security-group`,
            vpc,
            allowAllOutbound: true,
        });

        ecsSecurityGroup.connections.allowFrom(
            loadBalancer,
            Port.tcp(80),
            "Application load balancer"
        );

        const taskRole = new Role(this, `${appId}-TaskRole`, {
            assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
            roleName: `${appSlug}-task-role`,
        });

        const databaseSecret = Secret.fromSecretCompleteArn(this, `${appId}-Database-Secret`, props.secret.database);

        const dbUser = databaseSecret.secretValueFromJson('username').unsafeUnwrap();
        const dbPassword = databaseSecret.secretValueFromJson('password').unsafeUnwrap();
        const dbHost = databaseSecret.secretValueFromJson('host').unsafeUnwrap();
        const dbPort = databaseSecret.secretValueFromJson('port').unsafeUnwrap();
        const databaseUrl = `mysql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${props.database.name}?serverVersion=${props.database.version}`;

        const appSecrets = Secret.fromSecretCompleteArn(this, `${appId}-AppSecret`, props.secret.app);

        const cluster = new Cluster(this, appId, {
            vpc,
            clusterName: appSlug,
            enableFargateCapacityProviders: true,
            containerInsights: false,
        });

        // Service API
        const taskDefinition = new TaskDefinition(
            this,
            `${appId}-TaskDef`,
            {
                family: `${appSlug}-taskdef`,
                compatibility: Compatibility.EC2_AND_FARGATE,
                cpu: props.cluster.services.api.taskDefinition.cpu,
                memoryMiB: props.cluster.services.api.taskDefinition.memory,
                networkMode: NetworkMode.AWS_VPC,
                taskRole,
            }
        );

        // SES (Emails)
        const managedPolicy = ManagedPolicy.fromAwsManagedPolicyName(
            'AmazonSESFullAccess',
        );
        const sesUser = new User(this, `${appId}-Ses-Mail-User`, {
            userName: `${appSlug}-ses-mail-user`,
            managedPolicies: [managedPolicy],
        });
        const sesAccessKey = new CfnAccessKey(this, `${appId}-Ses-Mail-AccessKey`, {
            userName: sesUser.userName
        });

        taskDefinition.addContainer(`${appId}-Nginx`, {
            containerName: 'nginx',
            image: ContainerImage.fromEcrRepository(props.cluster.services.api.taskDefinition.container.nginx.repository, props.appVersion),
            essential: true,
            memoryReservationMiB: props.cluster.services.api.taskDefinition.container.nginx.memoryReservationMiB,
            environment: props.cluster.services.api.taskDefinition.container.nginx.environment,
            stopTimeout: Duration.seconds(2),
            portMappings: [
                {
                    hostPort: 80,
                    protocol: EcsProtocol.TCP,
                    containerPort: 80
                }
            ],
        });

        const apiAndConsumerCommonSecretList = {
            APP_SECRET: EcsSecret.fromSecretsManager(<ISecret>appSecrets, 'APP_SECRET'),
        };

        const apiAndConsumerCommonEnvironmentList = {
            APP_SES_ACCESS_KEY_ID: sesAccessKey.ref,
            APP_SES_ACCESS_KEY_SECRET: sesAccessKey.attrSecretAccessKey,
            // TODO: ADDBUCKET
            // APP_S3_BUCKET_NAME: bucket.bucketName,
            AWS_REGION: 'eu-west-3',
            DATABASE_URL: databaseUrl,
        }

        taskDefinition.addContainer(`${appId}-PHP-FPM`, {
            containerName: 'php-fpm',
            image: ContainerImage.fromEcrRepository(props.cluster.services.api.taskDefinition.container.php_fpm.repository, props.appVersion),
            essential: true,
            memoryReservationMiB: props.cluster.services.api.taskDefinition.container.php_fpm.memoryReservationMiB,
            entryPoint: ['sh', '-c', 'php-fpm'],
            environment: {
                ...props.cluster.services.api.taskDefinition.container.php_fpm.environment,
                ...apiAndConsumerCommonEnvironmentList,
            },
            secrets: apiAndConsumerCommonSecretList,
            stopTimeout: Duration.seconds(120),
            portMappings: [
                {
                    hostPort: 9000,
                    containerPort: 9000
                }
            ]
        });

        taskDefinition.addContainer(`${appId}-PHP-Supervisord`, {
            containerName: 'supervisor',
            image: ContainerImage.fromEcrRepository(props.cluster.services.api.taskDefinition.container.supervisor.repository, props.appVersion),
            essential: true,
            memoryReservationMiB: props.cluster.services.api.taskDefinition.container.supervisor.memoryReservationMiB,
            entryPoint: ['sh', '-c', 'supervisord'],
            environment: {
                ...props.cluster.services.api.taskDefinition.container.supervisor.environment,
                ...apiAndConsumerCommonEnvironmentList,
                ...{
                    DD_TRACE_CLI_ENABLED: '1',
                    DD_TRACE_AUTO_FLUSH_ENABLED: '1',
                    DD_TRACE_GENERATE_ROOT_SPAN: '0',
                },
            },
            secrets: apiAndConsumerCommonSecretList,
            stopTimeout: Duration.seconds(120),
        });

        const apiService = new FargateService(this, `${appId}-Service`, {
            serviceName: `${appSlug}`,
            cluster,
            taskDefinition,
            desiredCount: props.cluster.services.api.desiredCount,
            securityGroups: [ecsSecurityGroup],
            enableExecuteCommand: true,
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
            capacityProviderStrategies: props.cluster.services.api.capacityProviderConfig,
        });

        apiService.attachToApplicationTargetGroup(applicationTargetGroup);

        // TODO: ADDBUCKET
        // const bucket = new Bucket(this, `${appId}-S3-Bucket`, {
        //     versioned: false,
        //     bucketName: `${appSlug}-s3-bucket`,
        //     publicReadAccess: false,
        //     blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
        // });
        // bucket.grantReadWrite(apiService.taskDefinition.taskRole);

        // TODO: ADDQUEUE
        // props.queue.highPriorityQueue.grantPurge(apiService.taskDefinition.taskRole);
        // props.queue.highPriorityQueue.grantSendMessages(apiService.taskDefinition.taskRole);
        // props.queue.highPriorityQueue.grantConsumeMessages(apiService.taskDefinition.taskRole);
        //
        // props.queue.lowPriorityQueue.grantPurge(apiService.taskDefinition.taskRole);
        // props.queue.lowPriorityQueue.grantSendMessages(apiService.taskDefinition.taskRole);
        // props.queue.lowPriorityQueue.grantConsumeMessages(apiService.taskDefinition.taskRole);
        //
        // props.queue.failQueue.grantPurge(apiService.taskDefinition.taskRole);
        // props.queue.failQueue.grantSendMessages(apiService.taskDefinition.taskRole);
        // props.queue.failQueue.grantConsumeMessages(apiService.taskDefinition.taskRole);
    }
}
