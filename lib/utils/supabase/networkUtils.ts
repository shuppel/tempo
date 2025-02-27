/**
 * Network Utilities for checking connectivity and troubleshooting
 */

// List of reliable endpoints to check connectivity
const CONNECTIVITY_CHECK_ENDPOINTS = [
  'https://www.google.com', 
  'https://www.cloudflare.com',
  'https://www.microsoft.com'
];

/**
 * Checks if the browser has internet connectivity
 * @returns Promise<boolean> True if connected, false otherwise
 */
export const checkInternetConnectivity = async (): Promise<boolean> => {
  try {
    // Try multiple endpoints for more reliable checks
    for (const endpoint of CONNECTIVITY_CHECK_ENDPOINTS) {
      try {
        const controller = new AbortController();
        // Set a timeout to abort the request after 5 seconds
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(endpoint, {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-store',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // If we get here, we have connectivity to at least one endpoint
        return true;
      } catch (err) {
        // Try the next endpoint
        continue;
      }
    }
    
    // If we've tried all endpoints and failed, return false
    return false;
  } catch (err) {
    // General failure, no connectivity
    return false;
  }
};

/**
 * Checks if we can connect to Supabase
 * @param supabaseUrl The Supabase URL to check
 * @returns Promise<boolean> True if connected, false otherwise
 */
export const checkSupabaseConnectivity = async (supabaseUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    
    // Set a timeout to abort the request after 5 seconds
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    // In development, log the URL we're trying to connect to
    if (process.env.NODE_ENV === 'development') {
      console.log('Trying to connect to Supabase at:', supabaseUrl);
    }

    // For browser environments, try a more reliable test URL
    // that's less likely to be affected by CORS
    const testUrl = `${supabaseUrl}/auth/v1/`;
    
    // Using a HEAD request to the health check endpoint
    const response = await fetch(testUrl, {
      method: 'HEAD',
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      // Avoid CORS issues by not checking credentials
      credentials: 'omit' 
    });
    
    clearTimeout(timeoutId);
    
    // In development, log the result
    if (process.env.NODE_ENV === 'development') {
      console.log('Supabase connectivity check response:', response.status, response.ok);
    }
    
    // Just checking if we can reach the endpoint
    return response.ok;
  } catch (err) {
    console.error('Supabase connectivity check failed:', err);
    
    // In development, log more details
    if (process.env.NODE_ENV === 'development') {
      console.log('Supabase URL:', supabaseUrl);
      console.log('Error details:', err instanceof Error ? err.message : String(err));
    }
    
    return false;
  }
};

/**
 * Perform diagnostics on the application configuration
 * @returns Object with diagnostic information
 */
export const performNetworkDiagnostics = async () => {
  const hasInternet = await checkInternetConnectivity();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  
  const hasSupabaseConfig = !!supabaseUrl && !!supabaseAnonKey;
  let hasSupabaseConnectivity = false;
  
  if (hasInternet && hasSupabaseConfig) {
    hasSupabaseConnectivity = await checkSupabaseConnectivity(supabaseUrl);
  }
  
  return {
    timestamp: new Date().toISOString(),
    hasInternet,
    hasSupabaseConfig,
    hasSupabaseConnectivity,
    supabaseUrlConfigured: !!supabaseUrl,
    supabaseKeyConfigured: !!supabaseAnonKey,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
    diagnosticId: Math.random().toString(36).substring(2, 15)
  };
};

/**
 * Get troubleshooting suggestions based on diagnostic results
 * @param diagnostics The diagnostic results from performNetworkDiagnostics
 * @returns Array of troubleshooting suggestions
 */
export const getTroubleshootingSuggestions = (diagnostics: any) => {
  const suggestions: string[] = [];
  
  if (!diagnostics.hasInternet) {
    suggestions.push('Check your internet connection');
    suggestions.push('Try connecting to a different network');
    suggestions.push('Disable any VPN or proxy services temporarily');
  }
  
  if (!diagnostics.hasSupabaseConfig) {
    suggestions.push('Application is missing configuration. Please contact support.');
  }
  
  if (diagnostics.hasInternet && diagnostics.hasSupabaseConfig && !diagnostics.hasSupabaseConnectivity) {
    suggestions.push('Your network may be blocking access to the authentication service');
    suggestions.push('Try using a different browser');
    suggestions.push('Disable browser extensions that might block requests');
    suggestions.push('Check if your firewall or security software is blocking connections');
  }
  
  // Always add these general suggestions
  if (suggestions.length > 0) {
    suggestions.push('Try refreshing the page');
    suggestions.push('Clear your browser cache and cookies');
  }
  
  return suggestions;
}; 