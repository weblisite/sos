/**
 * AWS (General) Connector Executor
 * 
 * Executes AWS connector actions for general AWS services
 * Note: Specific services (S3, DynamoDB, RDS) have dedicated connectors
 */

import { NodeExecutionResult } from '@sos/shared';

interface AWSCredentials {
  access_key_id: string;
  secret_access_key: string;
  region?: string;
}

/**
 * Execute a generic AWS API call
 * 
 * Note: This is a placeholder for generic AWS operations
 * Specific services should use their dedicated connectors (S3, DynamoDB, RDS, etc.)
 */
export async function executeAWSOperation(
  service: string,
  action: string,
  parameters?: Record<string, unknown>,
  credentials: AWSCredentials
): Promise<NodeExecutionResult> {
  try {
    // AWS operations require service-specific SDKs
    // This connector provides a generic interface, but specific services should use dedicated connectors
    
    // Check if AWS SDK is available
    let awsSdk: any;
    try {
      awsSdk = await import('aws-sdk');
    } catch {
      // AWS SDK not installed - provide helpful error
      return {
        success: false,
        error: {
          message: `AWS ${service} operations require the AWS SDK. Install it with: npm install aws-sdk. For specific services, use dedicated connectors (S3, DynamoDB, RDS, etc.).`,
          code: 'AWS_SDK_NOT_INSTALLED',
          details: {
            service,
            action,
            region: credentials.region || 'us-east-1',
            installation: 'npm install aws-sdk',
            note: 'For production, use dedicated service connectors (S3, DynamoDB, RDS, Lambda, etc.) for better type safety and performance.',
          },
        },
      };
    }
    
    // Initialize AWS service client
    // Note: This is a generic implementation - specific services should use their dedicated SDKs
    const clientConfig = {
      accessKeyId: credentials.access_key_id,
      secretAccessKey: credentials.secret_access_key,
      region: credentials.region || 'us-east-1',
    };
    
    // For now, return helpful message about using dedicated connectors
    return {
      success: false,
      error: {
        message: `AWS ${service} operations are best handled by dedicated connectors. Use service-specific connectors (S3, DynamoDB, RDS, Lambda, etc.) for better integration.`,
        code: 'USE_DEDICATED_CONNECTOR',
        details: {
          service,
          action,
          region: credentials.region || 'us-east-1',
          availableConnectors: ['S3', 'DynamoDB', 'RDS', 'Lambda', 'SQS', 'SNS', 'CloudWatch', 'EC2', 'SES'],
          recommendation: `Use the dedicated ${service} connector for this operation.`,
        },
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: {
        message: error.message || 'AWS operation failed',
        code: 'AWS_OPERATION_ERROR',
        details: error,
      },
    };
  }
}

/**
 * Execute AWS connector action
 */
export async function executeAWS(
  actionId: string,
  input: Record<string, unknown>,
  credentials: AWSCredentials
): Promise<NodeExecutionResult> {
  switch (actionId) {
    case 'execute_operation':
      const service = input.service as string;
      const action = input.action as string;
      const parameters = input.parameters as Record<string, unknown> | undefined;
      
      if (!service || !action) {
        return {
          success: false,
          error: {
            message: 'service and action are required',
            code: 'MISSING_PARAMETERS',
          },
        };
      }
      return executeAWSOperation(service, action, parameters, credentials);

    default:
      return {
        success: false,
        error: {
          message: `Unknown AWS action: ${actionId}`,
          code: 'UNKNOWN_ACTION',
        },
      };
  }
}

