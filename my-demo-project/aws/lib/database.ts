import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { AuroraCapacityUnit, DatabaseClusterEngine, ServerlessCluster } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
import {AuroraMysqlEngineVersion} from "aws-cdk-lib/aws-rds/lib/cluster-engine";

interface DatabaseStackProps extends StackProps {
    appName: string;
    appEnv: string;
    vpcName: string;
    database: {
        clusterName: string,
        deletionProtection: boolean,
        backupRetention: Duration,
        scaling: {
            autoPause: Duration
            minCapacity: AuroraCapacityUnit,
            maxCapacity: AuroraCapacityUnit,
        }
    }
}

export class DatabaseStack extends Stack {
    readonly database: ServerlessCluster;

    constructor(scope: Construct, id: string, props: DatabaseStackProps) {
        super(scope, id, props);

        const appName = props.appName;
        const appPrefix = `${appName}-${props.appEnv}`;

        this.database = new ServerlessCluster(this, `${appPrefix}-Database`, {
            vpc: Vpc.fromLookup(this, `${appPrefix}-Vpc`, { vpcName: props.vpcName }),
            clusterIdentifier: props.database.clusterName,
            engine: DatabaseClusterEngine.AURORA_MYSQL,
            scaling: props.database.scaling,
            deletionProtection: props.database.deletionProtection,
            backupRetention: props.database.backupRetention,
            enableDataApi: true,
        });

        this.database.connections.allowDefaultPortFromAnyIpv4();

        new CfnOutput(this, `${appPrefix}-DatabaseUri`, {
            value: this.database.clusterEndpoint.socketAddress,
        });

        new CfnOutput(this, `${appPrefix}-ClusterIdentifier`, {
            value: this.database.clusterIdentifier,
        });
    }
}
