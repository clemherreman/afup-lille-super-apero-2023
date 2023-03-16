import { Stack, StackProps } from 'aws-cdk-lib';
import { IRepository, Repository } from 'aws-cdk-lib/aws-ecr';
import { Construct } from 'constructs';

interface RegistryStackProps extends StackProps {
    appName: string;
    appEnv: string;
    repository: {
        nginx: {
            name: string,
        }
        php: {
            name: string,
        }
        maxImageCount: number,
    }
}

export class RegistryStack extends Stack {
    readonly phpRepository: IRepository;
    readonly nginxRepository: IRepository;

    constructor(scope: Construct, id: string, props: RegistryStackProps) {
        super(scope, id, props);

        const appName = props.appName;
        const appPrefix = `${appName}-${props.appEnv}`;

        this.phpRepository = new Repository(this, `${appPrefix}-PHP-Repository`, {
            repositoryName: `${props.repository.php.name}`,
            lifecycleRules: [
                { maxImageCount: props.repository.maxImageCount },
            ]
        });

        this.nginxRepository = new Repository(this, `${appPrefix}-Nginx-Repository`, {
            repositoryName: `${props.repository.nginx.name}`,
            lifecycleRules: [
                { maxImageCount: props.repository.maxImageCount },
            ]
        });
    }
}