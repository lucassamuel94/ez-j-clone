import DOMPurify from 'dompurify';

/**
 * Sanitize HTML string to prevent XSS attacks.
 * Allows safe tags like formatting, links, images.
 */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['target', 'rel', 'allow', 'allowfullscreen', 'frameborder'],
  });
}
