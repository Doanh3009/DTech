export type TestEnvironmentInput = Record<string, string | undefined>;
export interface TestEnvironment { environment: string; databaseUrl: string; projectId: string }
export const TEST_OWNER: string;
export const TEST_GATE_COOKIE: string;
export function assertTestEnvironment(env?: TestEnvironmentInput): TestEnvironment;
export function configuredUrl(env: TestEnvironmentInput, key: string): URL;
export function testToolsAvailable(env?: TestEnvironmentInput): TestEnvironment | null;
export function safeEqual(left: string, right: string): boolean;
export function createTesterToken(env?: TestEnvironmentInput, now?: number): string;
export function validTesterToken(token: string, env?: TestEnvironmentInput, now?: number): boolean;
export function createTesterInvitation(env?: TestEnvironmentInput, now?: number, ttlMs?: number): string;
export function validTesterInvitation(token: string, env?: TestEnvironmentInput, now?: number): boolean;
export function sessionCookieNames(env?: TestEnvironmentInput): { access: string; refresh: string; session: string };
export function markedTestAccount(metadata: unknown): boolean;
export function productionAccountAllowed(metadata: unknown, env?: TestEnvironmentInput): boolean;
export function stagingAuthorized(authorization?: string | null, env?: TestEnvironmentInput): boolean;
export function externalDeliveryAllowed(env?: TestEnvironmentInput): boolean;
