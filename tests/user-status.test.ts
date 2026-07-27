import assert from "node:assert/strict";
import test from "node:test";
import { assertCustomerActive, assertCustomerNotBlocked, USER_PAUSED_ERROR, USER_BLOCKED_ERROR } from "../lib/customer-auth";
import type { User } from "@prisma/client";

function mockUser(status: "ACTIVE" | "PAUSE" | "BLOCK"): User {
  return {
    id: "usr_123",
    email: "user@example.com",
    name: "User Test",
    phone: "081234567890",
    phoneVerified: true,
    phoneVerifiedAt: new Date(),
    whatsappShipmentNotifications: false,
    whatsappShipmentConsentedAt: null,
    whatsappPromotionNotifications: false,
    whatsappPromotionConsentedAt: null,
    avatarUrl: null,
    googleId: "google_123",
    currentSessionId: "sess_123",
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

test("assertCustomerActive mengizinkan user ACTIVE dan menolak PAUSE / BLOCK", async () => {
  const activeUser = mockUser("ACTIVE");
  assert.equal(assertCustomerActive(activeUser), null);

  const pausedUser = mockUser("PAUSE");
  const pausedRes = assertCustomerActive(pausedUser);
  assert.notEqual(pausedRes, null);
  assert.equal(pausedRes?.status, 403);
  const pausedBody = await pausedRes?.json();
  assert.equal(pausedBody.error, USER_PAUSED_ERROR);

  const blockedUser = mockUser("BLOCK");
  const blockedRes = assertCustomerActive(blockedUser);
  assert.notEqual(blockedRes, null);
  assert.equal(blockedRes?.status, 403);
  const blockedBody = await blockedRes?.json();
  assert.equal(blockedBody.error, USER_BLOCKED_ERROR);
});

test("assertCustomerNotBlocked mengizinkan user ACTIVE & PAUSE, menolak BLOCK", async () => {
  const activeUser = mockUser("ACTIVE");
  assert.equal(assertCustomerNotBlocked(activeUser), null);

  const pausedUser = mockUser("PAUSE");
  assert.equal(assertCustomerNotBlocked(pausedUser), null);

  const blockedUser = mockUser("BLOCK");
  const blockedRes = assertCustomerNotBlocked(blockedUser);
  assert.notEqual(blockedRes, null);
  assert.equal(blockedRes?.status, 403);
  const blockedBody = await blockedRes?.json();
  assert.equal(blockedBody.error, USER_BLOCKED_ERROR);
});
