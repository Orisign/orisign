export const HANDLE_PATTERN = /^(?!_)(?!.*__)[a-z0-9_]{5,32}(?<!_)$/;
export const RESERVED_HANDLES = new Set([
  'admin',
  'administrator',
  'root',
  'support',
  'security',
  'system',
  'me',
  'api',
  'docs',
  'help',
]);
