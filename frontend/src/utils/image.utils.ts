/**
 * Utility to normalize and safe-check image URLs.
 * Handles backend absolute paths, external URLs, and missing values.
 */
export const getImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  
  // Trim whitespace
  const trimmed = url.trim();
  if (!trimmed || trimmed === '/' || trimmed === '/uploads/' || trimmed === '/uploads/profiles/' || trimmed === '/uploads/campaigns/') {
    return '';
  }

  // Already an absolute URL or data URI
  if (trimmed.startsWith('http') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // Ensure it starts with / for absolute paths from root
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Prepend / for relative-looking paths that should be absolute from root
  return `/${trimmed}`;
};
