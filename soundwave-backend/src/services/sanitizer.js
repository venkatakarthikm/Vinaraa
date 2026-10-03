'use strict';

function sanitizeHtml(htmlStr) {
  if (!htmlStr) return '';
  let str = String(htmlStr);
  // Remove script tags and contents
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove event handlers like onclick, onload, etc.
  str = str.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Remove javascript: URLs
  str = str.replace(/javascript:[^\s"'>]+/gi, '#');
  // Remove iframe, object, embed
  str = str.replace(/<\/?(iframe|object|embed|form|input)[^>]*>/gi, '');
  return str;
}

function escapeText(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderPlaceholders(templateStr, user = {}) {
  if (!templateStr) return '';
  const fullName = user.name || 'there';
  const firstName = fullName.trim().split(/\s+/)[0] || 'there';

  return String(templateStr)
    .replace(/\{\{\s*user\.name\s*\}\}/g, escapeText(fullName))
    .replace(/\{\{\s*user\.firstName\s*\}\}/g, escapeText(firstName));
}

module.exports = { sanitizeHtml, renderPlaceholders };
