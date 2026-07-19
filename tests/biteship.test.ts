import assert from "node:assert/strict";
import test from "node:test";
import { BiteshipAdapter, normalizeBiteshipStatus } from "../lib/adapters/biteship";

test("status Biteship camelCase dan snake_case dinormalisasi",()=>{
  assert.equal(normalizeBiteshipStatus("inTransit"),"in_transit");
  assert.equal(normalizeBiteshipStatus("in_transit"),"in_transit");
  assert.equal(normalizeBiteshipStatus("courierNotFound"),"courier_not_found");
  assert.equal(normalizeBiteshipStatus("picking_up"),"picking_up");
});

test("rates memakai field type resmi sebagai courier_type internal",async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({success:true,pricing:[{company:"jne",courier_name:"JNE",courier_service_name:"Reguler",type:"reg",price:12000,shipment_duration_range:"2 - 3",shipment_duration_unit:"days",available_collection_method:["pickup","drop_off"]}]}),{status:200,headers:{"Content-Type":"application/json"}});
  try{const data=await new BiteshipAdapter("https://example.test","test").rates({originPostalCode:12110,destinationPostalCode:12250,couriers:"jne",items:[{name:"Koko",value:100000,quantity:1,weight:250}]});assert.equal(data.pricing[0].courier_type,"reg");assert.deepEqual(data.pricing[0].available_collection_method,["pickup","drop_off"])}finally{globalThis.fetch=original}
});

test("duplicate reference Biteship dipulihkan dengan GET order yang sudah ada",async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(_input,init)=>{calls++;if(init?.method==="POST")return new Response(JSON.stringify({success:false,code:40002060,details:{order_id:"order-existing"}}),{status:400});return new Response(JSON.stringify({success:true,id:"order-existing",status:"confirmed",price:12000,courier:{tracking_id:"trk",waybill_id:"awb"}}),{status:200})};
  try{const result=await new BiteshipAdapter("https://example.test","test").createOrder({reference_id:"SHP-1"});assert.equal(result.id,"order-existing");assert.equal(calls,2)}finally{globalThis.fetch=original}
});

test("error 400 Biteship selain duplicate reference tidak dianggap sukses",async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(JSON.stringify({success:false,code:40000001,details:{order_id:"unrelated"}}),{status:400})};
  try{await assert.rejects(()=>new BiteshipAdapter("https://example.test","test").createOrder({reference_id:"SHP-2"}));assert.equal(calls,1)}finally{globalThis.fetch=original}
});
