const env =
  typeof window === "undefined"
    ? (process.env ?? {})
    : (((window as typeof window & { env?: Record<string, any> }).env ?? {}));

export default env as Record<string, any>;
