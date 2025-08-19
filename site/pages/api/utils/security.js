/**
 * Security utilities for API endpoints
 */

/**
 * Comprehensive escaping for Airtable formulas to prevent injection attacks
 * @param {string} value - The string to escape
 * @returns {string} - The escaped string
 */
export function escapeFormulaString(value) {
  // More comprehensive escaping for Airtable formulas
  return String(value)
    .replace(/"/g, '\\"')  // Escape double quotes
    .replace(/\{/g, '\\{') // Escape opening braces
    .replace(/\}/g, '\\}') // Escape closing braces
    .replace(/\(/g, '\\(') // Escape opening parentheses
    .replace(/\)/g, '\\)') // Escape closing parentheses
    .replace(/\+/g, '\\+') // Escape plus signs
    .replace(/-/g, '\\-')  // Escape minus signs
    .replace(/\*/g, '\\*') // Escape asterisks
    .replace(/\//g, '\\/') // Escape forward slashes
    .replace(/=/g, '\\=')  // Escape equals signs
    .replace(/</g, '\\<')  // Escape less than
    .replace(/>/g, '\\>')  // Escape greater than
    .replace(/!/g, '\\!')  // Escape exclamation marks
    .replace(/&/g, '\\&')  // Escape ampersands
    .replace(/\|/g, '\\|') // Escape pipes
    .replace(/\[/g, '\\[') // Escape square brackets
    .replace(/\]/g, '\\]') // Escape square brackets
    .replace(/\^/g, '\\^') // Escape caret
    .replace(/\$/g, '\\$') // Escape dollar sign
    .replace(/\?/g, '\\?') // Escape question mark
    .replace(/\./g, '\\.') // Escape dots
    .replace(/,/g, '\\,')  // Escape commas
    .replace(/;/g, '\\;')  // Escape semicolons
    .replace(/:/g, '\\:'); // Escape colons
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
