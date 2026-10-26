import "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    authVersion: number;
    issuedAt: number;
    lastActivityAt: number;
    absoluteExpiresAt: number;
    reauthenticatedAt?: number;
  }
}
