import { toast } from 'sonner';

/**
 * Checks if an error is a rate limit error (429)
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('resource_exhausted')
    );
  }
  return false;
}

/**
 * Shows appropriate toast notification for API errors
 */
export function handleApiError(error: unknown, context?: string): void {
  console.error(`API Error${context ? ` (${context})` : ''}:`, error);

  if (isRateLimitError(error)) {
    toast.error('Slow down! 🐢', {
      description: 'The AI is receiving too many requests. Please wait a moment and try again.',
      duration: 5000,
    });
    return;
  }

  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    toast.error('Connection issue', {
      description: 'Please check your internet connection and try again.',
      duration: 4000,
    });
    return;
  }

  // Generic error
  const message = error instanceof Error ? error.message : 'Something went wrong';
  toast.error('Oops!', {
    description: message.length > 100 ? 'An unexpected error occurred. Please try again.' : message,
    duration: 4000,
  });
}

/**
 * Wrapper for fetch that handles common errors
 */
export async function fetchWithErrorHandling<T>(
  url: string,
  options?: RequestInit,
  context?: string
): Promise<T> {
  try {
    const response = await fetch(url, options);

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded (429)');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    handleApiError(error, context);
    throw error;
  }
}
