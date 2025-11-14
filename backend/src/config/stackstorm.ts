/**
 * StackStorm Configuration
 * 
 * Configuration for StackStorm integration
 */

import dotenv from 'dotenv';
dotenv.config();

export interface StackStormConfig {
  enabled: boolean;
  apiUrl: string;
  authUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * Get StackStorm configuration from environment variables
 */
export function getStackStormConfig(): StackStormConfig {
  const enabled = process.env.STACKSTORM_ENABLED === 'true';
  const apiUrl = process.env.STACKSTORM_API_URL || 'http://localhost:9101/v1';
  const authUrl = process.env.STACKSTORM_AUTH_URL || 'http://localhost:9101/auth/v1';
  const apiKey = process.env.STACKSTORM_API_KEY;
  const username = process.env.STACKSTORM_USERNAME || 'st2admin';
  const password = process.env.STACKSTORM_PASSWORD;
  const timeout = parseInt(process.env.STACKSTORM_TIMEOUT || '30000', 10);
  const retryAttempts = parseInt(process.env.STACKSTORM_RETRY_ATTEMPTS || '3', 10);
  const retryDelay = parseInt(process.env.STACKSTORM_RETRY_DELAY || '1000', 10);

  return {
    enabled,
    apiUrl,
    authUrl,
    apiKey,
    username,
    password,
    timeout,
    retryAttempts,
    retryDelay,
  };
}

export const stackstormConfig = getStackStormConfig();

