/**
 * Policy Engine Service
 * 
 * Provides a configurable policy engine for routing rules and guardrails.
 * Allows organizations to define custom routing policies that are evaluated
 * at runtime to determine routing decisions.
 * 
 * Features:
 * - Rule-based policy evaluation
 * - Conditional routing based on policies
 * - Policy priority and conflict resolution
 * - Policy caching for performance
 * - Integration with ArchGW and Guardrails
 */

import { z } from 'zod';

/**
 * Policy rule condition
 */
export interface PolicyCondition {
  field: string; // Field to check (e.g., 'prompt.length', 'user.plan', 'cost.estimated')
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'regex' | 'exists';
  value: any; // Value to compare against
}

/**
 * Policy rule action
 */
export interface PolicyAction {
  type: 'route' | 'block' | 'warn' | 'modify' | 'log';
  target?: string; // Target for routing (e.g., 'model', 'region', 'provider')
  value?: any; // Value to set (e.g., model name, region)
  reason?: string; // Reason for action
}

/**
 * Policy rule
 */
export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  priority: number; // Higher priority rules are evaluated first
  enabled: boolean;
  conditions: PolicyCondition[]; // All conditions must match (AND logic)
  actions: PolicyAction[]; // Actions to take if conditions match
  metadata?: Record<string, any>;
}

/**
 * Policy set
 */
export interface PolicySet {
  id: string;
  name: string;
  description?: string;
  organizationId?: string;
  workspaceId?: string;
  rules: PolicyRule[];
  enabled: boolean;
  priority: number; // Higher priority policy sets are evaluated first
}

/**
 * Policy evaluation context
 */
export interface PolicyContext {
  // User context
  userId?: string;
  organizationId?: string;
  workspaceId?: string;
  userPlan?: 'free' | 'pro' | 'team' | 'enterprise';
  
  // Request context
  prompt?: string;
  promptLength?: number;
  requestedModel?: string;
  requestedProvider?: string;
  estimatedCost?: number;
  
  // Routing context
  region?: string;
  complianceRequirements?: string[];
  dataResidency?: string;
  
  // Custom context
  [key: string]: any;
}

/**
 * Policy evaluation result
 */
export interface PolicyEvaluationResult {
  matched: boolean;
  matchedRules: PolicyRule[];
  actions: PolicyAction[];
  modifiedContext?: Partial<PolicyContext>;
  blocked: boolean;
  warnings: string[];
  reason?: string;
}

/**
 * Policy Engine Service
 */
export class PolicyEngineService {
  private policySets: Map<string, PolicySet> = new Map();
  private policyCache: Map<string, { result: PolicyEvaluationResult; expiresAt: number }> = new Map();
  private cacheTTL: number = 60000; // 1 minute cache TTL

  /**
   * Register a policy set
   */
  registerPolicySet(policySet: PolicySet): void {
    // Sort rules by priority (higher first)
    policySet.rules.sort((a, b) => b.priority - a.priority);
    this.policySets.set(policySet.id, policySet);
  }

  /**
   * Unregister a policy set
   */
  unregisterPolicySet(policySetId: string): void {
    this.policySets.delete(policySetId);
  }

  /**
   * Get all policy sets for an organization/workspace
   */
  getPolicySets(organizationId?: string, workspaceId?: string): PolicySet[] {
    const sets: PolicySet[] = [];
    
    for (const policySet of this.policySets.values()) {
      if (!policySet.enabled) continue;
      
      // Filter by organization/workspace if specified
      if (organizationId && policySet.organizationId && policySet.organizationId !== organizationId) {
        continue;
      }
      if (workspaceId && policySet.workspaceId && policySet.workspaceId !== workspaceId) {
        continue;
      }
      
      sets.push(policySet);
    }
    
    // Sort by priority (higher first)
    return sets.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Evaluate policies against a context
   */
  async evaluatePolicies(
    context: PolicyContext,
    options: {
      organizationId?: string;
      workspaceId?: string;
      cacheKey?: string;
    } = {}
  ): Promise<PolicyEvaluationResult> {
    // Check cache
    if (options.cacheKey) {
      const cached = this.policyCache.get(options.cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
      }
    }

    const matchedRules: PolicyRule[] = [];
    const actions: PolicyAction[] = [];
    const warnings: string[] = [];
    let blocked = false;
    let modifiedContext: Partial<PolicyContext> = { ...context };

    // Get relevant policy sets
    const policySets = this.getPolicySets(
      options.organizationId || context.organizationId,
      options.workspaceId || context.workspaceId
    );

    // Evaluate each policy set
    for (const policySet of policySets) {
      if (!policySet.enabled) continue;

      // Evaluate rules in priority order
      for (const rule of policySet.rules) {
        if (!rule.enabled) continue;

        // Check if rule conditions match
        if (this.evaluateConditions(rule.conditions, modifiedContext)) {
          matchedRules.push(rule);

          // Apply rule actions
          for (const action of rule.actions) {
            actions.push(action);

            switch (action.type) {
              case 'block':
                blocked = true;
                break;

              case 'warn':
                warnings.push(action.reason || `Policy rule "${rule.name}" triggered warning`);
                break;

              case 'route':
                if (action.target && action.value !== undefined) {
                  modifiedContext[action.target] = action.value;
                }
                break;

              case 'modify':
                if (action.target && action.value !== undefined) {
                  modifiedContext[action.target] = action.value;
                }
                break;

              case 'log':
                // Log action (could be sent to observability service)
                console.log(`[Policy Engine] Rule "${rule.name}": ${action.reason || 'Action logged'}`);
                break;
            }

            // If blocked, stop evaluating further rules
            if (blocked) {
              break;
            }
          }

          // If blocked, stop evaluating further rules
          if (blocked) {
            break;
          }
        }
      }

      // If blocked, stop evaluating further policy sets
      if (blocked) {
        break;
      }
    }

    const result: PolicyEvaluationResult = {
      matched: matchedRules.length > 0,
      matchedRules,
      actions,
      modifiedContext: Object.keys(modifiedContext).length > Object.keys(context).length 
        ? modifiedContext 
        : undefined,
      blocked,
      warnings: warnings.length > 0 ? warnings : undefined,
      reason: blocked 
        ? `Blocked by policy rule: ${matchedRules[0]?.name || 'unknown'}`
        : matchedRules.length > 0
        ? `Matched ${matchedRules.length} policy rule(s)`
        : undefined,
    };

    // Cache result
    if (options.cacheKey) {
      this.policyCache.set(options.cacheKey, {
        result,
        expiresAt: Date.now() + this.cacheTTL,
      });
    }

    return result;
  }

  /**
   * Evaluate rule conditions
   */
  private evaluateConditions(conditions: PolicyCondition[], context: PolicyContext): boolean {
    if (conditions.length === 0) {
      return true; // No conditions means always match
    }

    // All conditions must match (AND logic)
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: PolicyCondition, context: PolicyContext): boolean {
    const fieldValue = this.getFieldValue(condition.field, context);

    switch (condition.operator) {
      case 'eq':
        return fieldValue === condition.value;

      case 'ne':
        return fieldValue !== condition.value;

      case 'gt':
        return typeof fieldValue === 'number' && fieldValue > condition.value;

      case 'gte':
        return typeof fieldValue === 'number' && fieldValue >= condition.value;

      case 'lt':
        return typeof fieldValue === 'number' && fieldValue < condition.value;

      case 'lte':
        return typeof fieldValue === 'number' && fieldValue <= condition.value;

      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);

      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);

      case 'contains':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          return fieldValue.includes(condition.value);
        }
        if (Array.isArray(fieldValue)) {
          return fieldValue.includes(condition.value);
        }
        return false;

      case 'regex':
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          try {
            const regex = new RegExp(condition.value);
            return regex.test(fieldValue);
          } catch {
            return false;
          }
        }
        return false;

      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;

      default:
        return false;
    }
  }

  /**
   * Get field value from context using dot notation
   */
  private getFieldValue(field: string, context: PolicyContext): any {
    const parts = field.split('.');
    let value: any = context;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Create a default policy set for an organization
   */
  createDefaultPolicySet(organizationId: string): PolicySet {
    return {
      id: `default-${organizationId}`,
      name: 'Default Policy Set',
      description: 'Default routing and guardrails policies',
      organizationId,
      enabled: true,
      priority: 0,
      rules: [
        // Example: Block free plan users from using premium models
        {
          id: 'free-plan-model-restriction',
          name: 'Free Plan Model Restriction',
          description: 'Restrict free plan users to basic models',
          priority: 100,
          enabled: true,
          conditions: [
            {
              field: 'userPlan',
              operator: 'eq',
              value: 'free',
            },
            {
              field: 'requestedModel',
              operator: 'in',
              value: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'claude-3-opus'],
            },
          ],
          actions: [
            {
              type: 'route',
              target: 'requestedModel',
              value: 'gpt-3.5-turbo',
              reason: 'Free plan users are restricted to basic models',
            },
          ],
        },
        // Example: Route EU users to EU region
        {
          id: 'eu-data-residency',
          name: 'EU Data Residency',
          description: 'Route EU users to EU region for GDPR compliance',
          priority: 200,
          enabled: true,
          conditions: [
            {
              field: 'dataResidency',
              operator: 'eq',
              value: 'EU',
            },
          ],
          actions: [
            {
              type: 'route',
              target: 'region',
              value: 'eu-west',
              reason: 'EU data residency requirement',
            },
          ],
        },
        // Example: Block high-cost requests for free plan
        {
          id: 'free-plan-cost-limit',
          name: 'Free Plan Cost Limit',
          description: 'Block requests exceeding cost limit for free plan',
          priority: 150,
          enabled: true,
          conditions: [
            {
              field: 'userPlan',
              operator: 'eq',
              value: 'free',
            },
            {
              field: 'estimatedCost',
              operator: 'gt',
              value: 0.01, // $0.01 USD
            },
          ],
          actions: [
            {
              type: 'block',
              reason: 'Request exceeds cost limit for free plan',
            },
          ],
        },
      ],
    };
  }

  /**
   * Clear policy cache
   */
  clearCache(): void {
    this.policyCache.clear();
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.policyCache.entries()) {
      if (cached.expiresAt < now) {
        this.policyCache.delete(key);
      }
    }
  }
}

// Singleton instance
export const policyEngineService = new PolicyEngineService();

// Start periodic cache cleanup
setInterval(() => {
  policyEngineService.cleanupCache();
}, 5 * 60 * 1000); // Every 5 minutes

