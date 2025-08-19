/**
 * Security utilities for API endpoints
 */

/**
 * Comprehensive escaping for Airtable formulas to prevent injection attacks
 * @param {string} value - The string to escape
 * @returns {string} - The escaped string
 */

/**
 * Safe escaping for Airtable formulas that only escapes truly dangerous characters
 * This is safer for normal data like emails, tokens, and names
 * @param {string} value - The string to escape
 * @returns {string} - The escaped string
 */
export function safeEscapeFormulaString(value) {
  return String(value)
    .replace(/"/g, '\\"')  // Escape double quotes (required)
    .replace(/\{/g, '\\{') // Escape opening braces (required)
    .replace(/\}/g, '\\}') // Escape closing braces (required)
    .replace(/\(/g, '\\(') // Escape opening parentheses (required)
    .replace(/\)/g, '\\)') // Escape closing parentheses (required)
    .replace(/\+/g, '\\+') // Escape plus signs (required for OR operations)
    .replace(/-/g, '\\-')  // Escape minus signs (required for ranges)
    .replace(/\*/g, '\\*') // Escape asterisks (required for wildcards)
    .replace(/\//g, '\\/') // Escape forward slashes (required for paths)
    .replace(/=/g, '\\=')  // Escape equals signs (required for comparisons)
    .replace(/</g, '\\<')  // Escape less than (required for comparisons)
    .replace(/>/g, '\\>')  // Escape greater than (required for comparisons)
    .replace(/!/g, '\\!')  // Escape exclamation marks (required for NOT operations)
    .replace(/&/g, '\\&')  // Escape ampersands (required for AND operations)
    .replace(/\|/g, '\\|') // Escape pipes (required for OR operations)
    .replace(/\[/g, '\\[') // Escape square brackets (required for arrays)
    .replace(/\]/g, '\\]') // Escape square brackets (required for arrays)
    .replace(/\^/g, '\\^') // Escape caret (required for regex)
    .replace(/\$/g, '\\$') // Escape dollar sign (required for regex)
    .replace(/\?/g, '\\?') // Escape question mark (required for regex)
    // Don't escape dots, commas, semicolons, or colons as they're commonly needed
}

/**
 * Generate cryptographically secure random string
 * @param {number} length - Length of the string to generate
 * @param {string} charset - Character set to use (default: alphanumeric)
 * @returns {string} - Random string
 */
export function generateSecureRandomString(length, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  const crypto = require('crypto');
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += charset[randomBytes[i] % charset.length];
  }
  return result;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate URL format and security
 * @param {string} url - URL to validate
 * @param {string[]} allowedProtocols - Allowed protocols (default: ['https:'])
 * @param {string[]} allowedHostnames - Allowed hostnames (optional)
 * @returns {boolean} - Whether URL is valid and secure
 */
export function isValidUrl(url, allowedProtocols = ['https:'], allowedHostnames = []) {
  try {
    const urlObj = new URL(url);
    
    // Check protocol
    if (!allowedProtocols.includes(urlObj.protocol)) {
      return false;
    }
    
    // Check hostname if specified
    if (allowedHostnames.length > 0 && !allowedHostnames.includes(urlObj.hostname)) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize HTML content to prevent XSS
 * @param {string} content - Content to sanitize
 * @returns {string} - Sanitized content
 */
export function sanitizeHtml(content) {
  return String(content)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
