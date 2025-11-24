/**
 * Standardized Error Response Handler
 * 
 * Ensures all API endpoints return consistent error formats
 */

export interface StandardErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: unknown;
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: string,
  message?: string,
  code?: string,
  details?: unknown
): StandardErrorResponse {
  const response: StandardErrorResponse = { error };
  if (message) response.message = message;
  if (code) response.code = code;
  if (details) response.details = details;
  return response;
}

/**
 * Handle errors consistently across all routes
 */
export function handleError(error: unknown, defaultMessage = 'Internal server error'): StandardErrorResponse {
  if (error instanceof Error) {
    return createErrorResponse(
      defaultMessage,
      error.message,
      error.name,
      process.env.NODE_ENV === 'development' ? { stack: error.stack } : undefined
    );
  }
  
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return createErrorResponse(
      defaultMessage,
      String((error as any).message),
      (error as any).code,
      (error as any).details
    );
  }
  
  return createErrorResponse(defaultMessage);
}

