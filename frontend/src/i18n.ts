import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale = "fi" }) => ({
  locale,
  messages: (await import(`../messages/${locale}.json`)).default,
}));
