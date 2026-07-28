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

test("pengurutan alamat mengutamakan alamat default", () => {
  const addresses = [
    { id: "1", label: "Rumah", isDefault: false },
    { id: "2", label: "Kantor", isDefault: true },
    { id: "3", label: "Gudang", isDefault: false },
  ];

  const sorted = [...addresses].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));
  assert.equal(sorted[0].id, "2");
  assert.equal(sorted[0].isDefault, true);

  const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
  assert.equal(defaultAddr.id, "2");
});
