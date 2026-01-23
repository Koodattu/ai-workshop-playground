export const config = {
  // Empty string for relative URLs - Next.js rewrites handle dev, Nginx handles prod
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "",
} as const;
