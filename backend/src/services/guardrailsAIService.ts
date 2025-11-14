/**
 * GuardrailsAI Service Wrapper
 * 
 * Provides GuardrailsAI-like functionality for JSON schema validation and policy enforcement.
 * Since GuardrailsAI is primarily a Python library, this service provides:
 * - JSON schema validation using Ajv
 * - Policy validation
 * - Structured output validation
 * - Optional integration with GuardrailsAI Python service via API
 */

import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { z } from 'zod';

/**
 * JSON Schema validation result
 */
export interface JSONSchemaValidationResult {
  valid: boolean;
  errors?: Array<{
    path: string;
    message: string;
    schemaPath?: string;
    params?: Record<string, any>;
  }>;
  data?: any; // Validated and potentially coerced data
}

/**
 * Policy validation result
 */
export interface PolicyValidationResult {
  valid: boolean;
  violations?: Array<{
    policy: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    details?: Record<string, any>;
  }>;
}

/**
 * GuardrailsAI validation options
 */
export interface GuardrailsAIOptions {
  // JSON Schema validation
  schema?: Record<string, any>; // JSON Schema object
  schemaString?: string; // JSON Schema as string
  
  // Policy validation
  policies?: Array<{
    name: string;
    rule: (data: any) => boolean | { valid: boolean; message?: string; details?: any };
    severity?: 'low' | 'medium' | 'high' | 'critical';
  }>;
  
  // Validation options
  coerceTypes?: boolean; // Coerce types to match schema
  removeAdditional?: boolean; // Remove additional properties not in schema
  useDefaults?: boolean; // Use default values from schema
  
  // GuardrailsAI API integration (optional)
  apiUrl?: string;
  apiKey?: string;
  useAPI?: boolean; // Use GuardrailsAI Python API if available
}

/**
 * Complete validation result
 */
export interface GuardrailsAIValidationResult {
  valid: boolean;
  schemaValidation?: JSONSchemaValidationResult;
  policyValidation?: PolicyValidationResult;
  errors?: string[];
  warnings?: string[];
  data?: any; // Validated and processed data
}

/**
 * GuardrailsAI Service
 */
export class GuardrailsAIService {
  private ajv: Ajv;
  private schemaCache: Map<string, ValidateFunction> = new Map();

  constructor() {
    // Initialize Ajv with options
    this.ajv = new Ajv({
      allErrors: true, // Collect all errors
      verbose: true, // Include schema path in errors
      strict: false, // Allow additional properties by default
      coerceTypes: true, // Coerce types
      removeAdditional: false, // Don't remove additional properties by default
      useDefaults: true, // Use default values
    });

    // Add format validators (email, date, etc.)
    addFormats(this.ajv);
  }

  /**
   * Validate data against JSON Schema
   */
  validateJSONSchema(
    data: any,
    schema: Record<string, any> | string,
    options: {
      coerceTypes?: boolean;
      removeAdditional?: boolean;
      useDefaults?: boolean;
    } = {}
  ): JSONSchemaValidationResult {
    try {
      // Parse schema if it's a string
      const schemaObj = typeof schema === 'string' ? JSON.parse(schema) : schema;

      // Create cache key
      const cacheKey = JSON.stringify(schemaObj);

      // Get or create validator
      let validate: ValidateFunction;
      if (this.schemaCache.has(cacheKey)) {
        validate = this.schemaCache.get(cacheKey)!;
      } else {
        // Configure Ajv with options
        const ajvOptions: any = {};
        if (options.coerceTypes !== undefined) {
          ajvOptions.coerceTypes = options.coerceTypes;
        }
        if (options.removeAdditional !== undefined) {
          ajvOptions.removeAdditional = options.removeAdditional;
        }
        if (options.useDefaults !== undefined) {
          ajvOptions.useDefaults = options.useDefaults;
        }

        const tempAjv = new Ajv({
          ...this.ajv.opts,
          ...ajvOptions,
        });
        addFormats(tempAjv);

        validate = tempAjv.compile(schemaObj);
        this.schemaCache.set(cacheKey, validate);
      }

      // Validate data
      const valid = validate(data);

      if (valid) {
        return {
          valid: true,
          data: data, // Return validated data (may be coerced)
        };
      } else {
        // Format errors
        const errors = (validate.errors || []).map((error: ErrorObject) => ({
          path: error.instancePath || error.schemaPath || '/',
          message: error.message || 'Validation error',
          schemaPath: error.schemaPath,
          params: error.params,
        }));

        return {
          valid: false,
          errors,
        };
      }
    } catch (error: any) {
      return {
        valid: false,
        errors: [
          {
            path: '/',
            message: `Schema validation failed: ${error.message}`,
          },
        ],
      };
    }
  }

  /**
   * Validate data against policies
   */
  validatePolicies(
    data: any,
    policies: Array<{
      name: string;
      rule: (data: any) => boolean | { valid: boolean; message?: string; details?: any };
      severity?: 'low' | 'medium' | 'high' | 'critical';
    }>
  ): PolicyValidationResult {
    const violations: PolicyValidationResult['violations'] = [];

    for (const policy of policies) {
      try {
        const result = policy.rule(data);
        
        if (typeof result === 'boolean') {
          if (!result) {
            violations.push({
              policy: policy.name,
              severity: policy.severity || 'medium',
              message: `Policy ${policy.name} validation failed`,
            });
          }
        } else {
          if (!result.valid) {
            violations.push({
              policy: policy.name,
              severity: policy.severity || 'medium',
              message: result.message || `Policy ${policy.name} validation failed`,
              details: result.details,
            });
          }
        }
      } catch (error: any) {
        violations.push({
          policy: policy.name,
          severity: 'high',
          message: `Policy ${policy.name} evaluation error: ${error.message}`,
        });
      }
    }

    return {
      valid: violations.length === 0,
      violations: violations.length > 0 ? violations : undefined,
    };
  }

  /**
   * Validate using GuardrailsAI (JSON Schema + Policies)
   */
  async validate(
    data: any,
    options: GuardrailsAIOptions = {}
  ): Promise<GuardrailsAIValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let validatedData = data;

    // Step 1: JSON Schema validation
    let schemaValidation: JSONSchemaValidationResult | undefined;
    if (options.schema || options.schemaString) {
      schemaValidation = this.validateJSONSchema(data, options.schema || options.schemaString!, {
        coerceTypes: options.coerceTypes,
        removeAdditional: options.removeAdditional,
        useDefaults: options.useDefaults,
      });

      if (!schemaValidation.valid) {
        errors.push(
          ...(schemaValidation.errors || []).map(e => `${e.path}: ${e.message}`)
        );
      } else if (schemaValidation.data !== undefined) {
        // Use validated/coerced data
        validatedData = schemaValidation.data;
      }
    }

    // Step 2: Policy validation
    let policyValidation: PolicyValidationResult | undefined;
    if (options.policies && options.policies.length > 0) {
      policyValidation = this.validatePolicies(validatedData, options.policies);

      if (!policyValidation.valid && policyValidation.violations) {
        for (const violation of policyValidation.violations) {
          if (violation.severity === 'critical' || violation.severity === 'high') {
            errors.push(`Policy ${violation.policy}: ${violation.message}`);
          } else {
            warnings.push(`Policy ${violation.policy}: ${violation.message}`);
          }
        }
      }
    }

    // Step 3: Optional GuardrailsAI API validation (if enabled)
    if (options.useAPI && options.apiUrl && options.apiKey) {
      try {
        const apiResult = await this.validateViaAPI(validatedData, options);
        if (!apiResult.valid) {
          errors.push(...(apiResult.errors || []));
        }
        if (apiResult.warnings) {
          warnings.push(...apiResult.warnings);
        }
      } catch (error: any) {
        warnings.push(`GuardrailsAI API validation failed: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      schemaValidation,
      policyValidation,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: validatedData,
    };
  }

  /**
   * Validate via GuardrailsAI Python API (optional)
   */
  private async validateViaAPI(
    data: any,
    options: GuardrailsAIOptions
  ): Promise<{ valid: boolean; errors?: string[]; warnings?: string[] }> {
    // This would call a GuardrailsAI Python service if available
    // For now, return a placeholder implementation
    
    if (!options.apiUrl || !options.apiKey) {
      return { valid: true };
    }

    try {
      // Example API call (would need to be implemented based on actual GuardrailsAI API)
      const response = await fetch(`${options.apiUrl}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${options.apiKey}`,
        },
        body: JSON.stringify({
          data,
          schema: options.schema || options.schemaString,
          policies: options.policies?.map(p => p.name),
        }),
      });

      if (!response.ok) {
        throw new Error(`API validation failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        valid: result.valid || false,
        errors: result.errors,
        warnings: result.warnings,
      };
    } catch (error: any) {
      // If API is not available, fall back to local validation
      return {
        valid: true,
        warnings: [`GuardrailsAI API unavailable: ${error.message}`],
      };
    }
  }

  /**
   * Convert Zod schema to JSON Schema
   */
  zodToJSONSchema(zodSchema: z.ZodSchema): Record<string, any> {
    // This is a simplified conversion
    // For full support, consider using zod-to-json-schema library
    
    // Basic type mapping
    if (zodSchema instanceof z.ZodString) {
      return { type: 'string' };
    }
    if (zodSchema instanceof z.ZodNumber) {
      return { type: 'number' };
    }
    if (zodSchema instanceof z.ZodBoolean) {
      return { type: 'boolean' };
    }
    if (zodSchema instanceof z.ZodArray) {
      return {
        type: 'array',
        items: this.zodToJSONSchema(zodSchema._def.type),
      };
    }
    if (zodSchema instanceof z.ZodObject) {
      const properties: Record<string, any> = {};
      const required: string[] = [];
      
      const shape = zodSchema._def.shape();
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = this.zodToJSONSchema(value as z.ZodSchema);
        // Check if field is optional
        if (!(value as any)._def.optional) {
          required.push(key);
        }
      }
      
      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
    
    // Default fallback
    return { type: 'object' };
  }

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.schemaCache.clear();
  }
}

// Singleton instance
export const guardrailsAIService = new GuardrailsAIService();

