declare global {
  interface Window {
    env: Record<string, any>;
  }
}

const runtimeEnv =
  typeof window !== "undefined" ? (window.env ?? {}) : (process.env ?? {});

const env: Record<string, any> & {
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
} = {
  ...runtimeEnv,
  isDevelopment: runtimeEnv.ENVIRONMENT === "development",
  isTest: runtimeEnv.ENVIRONMENT === "test",
  isProduction: runtimeEnv.ENVIRONMENT === "production",
};

export default env;
