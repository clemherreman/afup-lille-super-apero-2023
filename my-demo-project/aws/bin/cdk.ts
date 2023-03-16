#!/usr/bin/env node
import {App, Duration} from 'aws-cdk-lib';
import {RegistryStack} from '../lib/registry';
import {AppStack} from '../lib/app';
import {SQSStack} from "../lib/sqs";
import {DatabaseStack} from "../lib/database";
import {VpcStack} from "../lib/vpc";
import {LoadBalancerStack} from "../lib/load-balancer";

const env = { account: '586412372178', region: 'eu-west-3' };

const app = new App();
new VpcStack(app, 'VpcParis', {
    stackName: 'VpcParis',
    terminationProtection: true,
    env,
    name: 'PocEcsCherreman',
    maxAzs: 2,
    natGateways: 1,
});

const vpcName = 'VpcParis/PocEcsCherreman';
const appName = 'afup-demo-app';
const appVersion = process.env.CI_COMMIT_SHORT_SHA || 'latest';

const loadBalancerDev = new LoadBalancerStack(app, 'load-balancer-dev', {
    env,
    stackName: `${appName}-load-balancer-dev`,
    terminationProtection: false,
});

const loadBalancerProd = new LoadBalancerStack(app, 'load-balancer-prod', {
    env,
    stackName: `${appName}-load-balancer-prod`,
    terminationProtection: false,
});

// TODO: ADDQUEUE
// const SQSDev = new SQSStack(app, 'sqs-dev', {
//     env,
//     stackName: `${appName}-sqs-dev`,
//     appName,
//     appEnv: 'dev',
// });

const repositoryDev = new RegistryStack(app, 'registry-dev', {
    env,
    stackName: `${appName}-registry-dev`,
    appEnv: 'dev',
    appName,
    repository: {
        nginx: {
            name: `${appName}-nginx-dev`,
        },
        php: {
            name: `${appName}-php-dev`,
        },
        maxImageCount: 10,
    }
});

// TODO: ADDQUEUE
// const SQSProd = new SQSStack(app, 'sqs-prod', {
//     env,
//     stackName: `${appName}-sqs-prod`,
//     appName,
//     appEnv: 'prod',
// });

const repositoryProd = new RegistryStack(app, 'registry-prod', {
    env,
    stackName: `${appName}-registry-prod`,
    appEnv: 'prod',
    appName,
    terminationProtection: true,
    repository: {
        nginx: {
            name: `${appName}-nginx-prod`,
        },
        php: {
            name: `${appName}-php-prod`,
        },
        maxImageCount: 10,
    }
});

const databaseDev = new DatabaseStack(app, 'database-dev', {
    env,
    appEnv: 'dev',
    appName,
    vpcName,
    terminationProtection: true,
    stackName: `${appName}-database-dev`,
    database: {
        backupRetention: Duration.days(1),
        clusterName: `${appName}-dev`,
        deletionProtection: true,
        scaling: {
            autoPause: Duration.seconds(0),
            maxCapacity: 1,
            minCapacity: 1
        }
    },
});


const databaseProd = new DatabaseStack(app, 'database-prod', {
    env,
    appEnv: 'prod',
    appName,
    vpcName,
    terminationProtection: true,
    stackName: `${appName}-database-prod`,
    database: {
        backupRetention: Duration.days(35), // $$$
        clusterName: `${appName}-prod`,
        deletionProtection: true,
        scaling: {
            autoPause: Duration.seconds(0),
            maxCapacity: 5, // $$$
            minCapacity: 1
        }
    },
});

const devEnvironmentVariables = {
    APP_ENV: 'prod', // yes, prod

    APP_PUBLIC_API_URL: "https://some.public.api.com",

    SENTRY_DSN: '',

    // Dev: all emails goes to dev@exotec.com
    APP_SENDER_EMAIL: "dev@exotec.com",
    APP_LOGISTICS_EMAIL: '["dev@exotec.net"]',
    APP_ACCOUNTING_EMAIL: '["dev@exotec.net"]',

    APP_SOME_SOAP_URL: "https://e-station-testenv.cargonet.software/eprintwebservice/eprintwebservice.asmx?WSDL",
    APP_SOME_SOAP_URL_DEBUG: "true",

    // TODO: ADDQUEUE
    // MESSENGER_TRANSPORT_HIGH_DSN: SQSDev.highPriorityQueue.queueUrl,
    // MESSENGER_TRANSPORT_LOW_DSN: SQSDev.highPriorityQueue.queueUrl,
    // MESSENGER_TRANSPORT_FAILED_DEPRECATED_DSN: SQSDev.failQueue.queueUrl,
    // MESSENGER_TRANSPORT_FAILED_DSN: 'doctrine://default?queue_name=failed',
};

const prodEnvironmentVariables = {
    APP_ENV: 'prod',

    APP_PUBLIC_API_URL: "https://some.public.api.com",

    SENTRY_DSN: '',

    APP_SENDER_EMAIL: "dev@exotec.com",
    APP_LOGISTICS_EMAIL: '["logistics@exotec.net"]',
    APP_ACCOUNTING_EMAIL: '["accounting@exotec.net"]',

    APP_SOME_SOAP_URL: "https://e-station-prodnv.cargonet.software/eprintwebservice/eprintwebservice.asmx?WSDL",
    APP_SOME_SOAP_URL_DEBUG: "false",

    // TODO: ADDQUEUE
    // MESSENGER_TRANSPORT_HIGH_DSN: SQSDev.highPriorityQueue.queueUrl,
    // MESSENGER_TRANSPORT_LOW_DSN: SQSDev.highPriorityQueue.queueUrl,
    // MESSENGER_TRANSPORT_FAILED_DEPRECATED_DSN: SQSDev.failQueue.queueUrl,
    // MESSENGER_TRANSPORT_FAILED_DSN: 'doctrine://default?queue_name=failed',
};

new AppStack(
    app,
    'app-dev',
    {
        env,
        stackName: `${appName}-dev`,
        appEnv: 'dev',
        appName,
        vpcName,
        appVersion,
        appSubDomainName: `dev-${appName}`,
        domain: 'myapp.fr',
        database: {
            name: `${appName}-dev`,
            version: '8.0'
        },
        secret: {
            app: 'arn:aws:secretsmanager:eu-west-3:586412372178:secret:afup-demo-app-dev-uFkPOt',
            database: databaseDev.database.secret?.secretFullArn?.toString() || ''
        },
        loadBalancer: { // from load-balancer.ts earlier
            arn: 'arn:aws:elasticloadbalancing:eu-west-3:586412372178:loadbalancer/app/load-balancer-paris/392b8aafe7ada254',
            listener: {
                arn: 'arn:aws:elasticloadbalancing:eu-west-3:586412372178:listener/app/load-balancer-paris/392b8aafe7ada254/6f58807bd62a7d38',
                priority: 210
            }
        },
        // TODO: ADDQUEUE
        // queue: {
        //     highPriorityQueue: SQSDev.highPriorityQueue,
        //     lowPriorityQueue: SQSDev.lowPriorityQueue,
        //     failQueue: SQSDev.failQueue,
        // },
        cluster: {
            services: {
                api: {
                    capacityProviderConfig: [
                        { capacityProvider: 'FARGATE_SPOT', weight: 1 },
                    ],
                    taskDefinition: {
                        cpu: '512',
                        memory: '1024',
                        container: {
                            nginx: {
                                repository: repositoryDev.nginxRepository,
                                environment: {
                                    PHP_HOST: 'localhost',
                                    DD_AGENT_HOST: 'localhost',
                                    DD_TRACE_AGENT_PORT: '8126',
                                    DD_ENV: 'dev',
                                    DD_SERVICE: `${appName}-nginx`,
                                },
                                memoryReservationMiB: 64
                            },
                            php_fpm: {
                                repository: repositoryDev.phpRepository,
                                environment: devEnvironmentVariables,
                                memoryReservationMiB: 128,
                            },
                            supervisor: {
                                repository: repositoryDev.phpRepository,
                                environment: devEnvironmentVariables,
                                memoryReservationMiB: 576,
                            },
                        },
                    },
                    desiredCount: 1,
                },
            }
        }
    }
);

// new AppStack(
//     app,
//     'app-prod',
//     {
//         env,
//         stackName: `${appName}-prod`,
//         appEnv: 'prod',
//         appName,
//         vpcName,
//         appVersion,
//         appSubDomainName: "www",
//         domain: 'myapp.fr',
//         database: {
//             name: `${appName}-prod`,
//             version: '8.0'
//         },
//         secret: {
//             app: 'arn:aws:secretsmanager:eu-west-3:232185866524:secret:prod/Glue-pW7TnM',
//             database: databaseProd.database.secret?.secretFullArn?.toString() || ''
//         },
//         loadBalancer: {
//             arn: 'arn:aws:elasticloadbalancing:eu-west-3:232185866524:loadbalancer/app/load-balancer-paris/e12f66e75b413ca5',
//             listener: {
//                 arn: 'arn:aws:elasticloadbalancing:eu-west-3:232185866524:listener/app/load-balancer-paris/e12f66e75b413ca5/5929f85941198ea6',
//                 priority: 200
//             }
//         },
//         // TODO: ADDQUEUE
//         // queue: {
//         //     highPriorityQueue: SQSProd.highPriorityQueue,
//         //     lowPriorityQueue: SQSProd.lowPriorityQueue,
//         //     failQueue: SQSProd.failQueue,
//         // },
//         cluster: {
//             services: {
//                 api: {
//                     capacityProviderConfig: [
//                         { capacityProvider: 'FARGATE_SPOT', weight: 1 },
//                     ],
//                     taskDefinition: {
//                         cpu: '512',
//                         memory: '1024',
//                         container: {
//                             nginx: {
//                                 repository: repositoryProd.nginxRepository,
//                                 environment: {
//                                     PHP_HOST: 'localhost',
//                                     DD_ENV: 'prod',
//                                     DD_SERVICE: `${appName}-nginx`,
//                                     DD_AGENT_HOST: 'localhost',
//                                 },
//                                 memoryReservationMiB: 64
//                             },
//                             php_fpm: {
//                                 repository: repositoryProd.phpRepository,
//                                 environment: prodEnvironmentVariables,
//                                 memoryReservationMiB: 128,
//                             },
//                             supervisor: {
//                                 repository: repositoryProd.phpRepository,
//                                 environment: prodEnvironmentVariables,
//                                 memoryReservationMiB: 576,
//                             },
//                         },
//                     },
//                     desiredCount: 1,
//                 },
//             }
//         }
//     }
// );
