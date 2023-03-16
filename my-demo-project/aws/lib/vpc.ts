import {Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Vpc} from 'aws-cdk-lib/aws-ec2';

interface VPCProps extends StackProps {
    name: string,
    maxAzs: number,
    natGateways: number,
}

export class VpcStack extends Stack {
    constructor(scope: Construct, id: string, props: VPCProps) {
        super(scope, id, props);

        const vpc = new Vpc(this, props.name, {
            maxAzs: props.maxAzs,
            natGateways: props.natGateways,
        });
    }
}
