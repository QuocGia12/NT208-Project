export const getAllowedOrigins = (): string[] => {
  const origins =
    process.env.FRONTEND_ORIGINS ??
    process.env.FRONTEND_ORIGIN ??
    'http://localhost:3000';

  return origins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};
