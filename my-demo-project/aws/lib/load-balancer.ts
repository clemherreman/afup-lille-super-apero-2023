import {CfnOutput, Duration, Stack, StackProps} from 'aws-cdk-lib'
import {Vpc} from 'aws-cdk-lib/aws-ec2'
import {
    ApplicationLoadBalancer,
    ApplicationProtocol, ApplicationTargetGroup,
    ListenerAction, ListenerCondition, NetworkLoadBalancer, Protocol, TargetType,
} from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import { Construct } from 'constructs'

export class LoadBalancerStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const vpc = Vpc.fromLookup(this, `Vpc`, { vpcName: 'VpcParis/PocEcsCherreman' })

        const loadBalancer = new ApplicationLoadBalancer(this, `LoadBalancer`, {
            loadBalancerName: 'load-balancer-paris',
            vpc,
            vpcSubnets: { subnets: vpc.publicSubnets },
            internetFacing: true,
            http2Enabled: true,
        })

        const listener80 = loadBalancer.addListener('Listener80', {
            port: 80,
            open: true,
            protocol: ApplicationProtocol.HTTP,
            defaultAction: ListenerAction.fixedResponse(503, {
                contentType: 'application/json'
            })
        })

        new CfnOutput(this, 'loadBalancerARN', {
            value: loadBalancer.loadBalancerArn,
        })

        new CfnOutput(this, 'loadBalancerDnsName', {
            value: loadBalancer.loadBalancerDnsName,
        })

        new CfnOutput(this, 'Listener80Arn', {
            value: listener80.listenerArn,
        })
    }
}
