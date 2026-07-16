import assert from "node:assert/strict";
import test from "node:test";
import { assertOrderTransition, canOrderTransition } from "../lib/state-machine";
import { constantTimeEqual, hmacHex, randomToken, sha256 } from "../lib/security";

test("fulfillment hanya mengikuti transisi operasional yang diizinkan",()=>{
  assert.equal(canOrderTransition("awaiting_processing","processing"),true);
  assert.equal(canOrderTransition("processing","packed"),true);
  assert.equal(canOrderTransition("handed_over","cancelled"),false);
  assert.throws(()=>assertOrderTransition("handed_over","cancelled"),/Transisi order tidak valid/);
  assert.equal(canOrderTransition("packed","shipment_booked"),true);
  assert.equal(canOrderTransition("shipment_booked","handover_pending"),true);
});

test("token order acak dan hash tidak membocorkan token",async()=>{
  const token=randomToken();
  assert.equal(token.length,64);
  const digest=await sha256(token);
  assert.equal(digest.length,64);
  assert.notEqual(token,digest);
});

test("signature webhook dibandingkan konstan",async()=>{
  const signature=await hmacHex("secret-testing","{\"event\":\"paid\"}");
  assert.equal(signature.length,64);
  assert.equal(constantTimeEqual(signature,signature),true);
  assert.equal(constantTimeEqual(signature,`${signature.slice(0,-1)}0`),false);
});
