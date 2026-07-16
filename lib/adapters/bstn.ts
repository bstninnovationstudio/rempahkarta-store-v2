import { constantTimeEqual, hmacHex } from "@/lib/security";

export type BstnItem={id?:string;name:string;price:number;quantity:number};
export class BstnPaymentAdapter {
  constructor(private baseUrl:string,private apiKey:string,private signatureSecret:string){}
  private async request<T>(path:string,init?:RequestInit):Promise<T>{const response=await fetch(`${this.baseUrl}${path}`,{...init,headers:{Authorization:`Bearer ${this.apiKey}`,"Content-Type":"application/json",...(init?.headers||{})}});const json=await response.json();if(!response.ok)throw new Error(`BSTN ${response.status}: ${JSON.stringify(json)}`);return json as T}
  createPayment(input:{reference:string;amount:number;description:string;customer:{name:string;email:string;phone:string};items:BstnItem[];finishUrl:string;webhookUrl:string;expiryMinutes?:number}){return this.request<{success:boolean;data:{payment_id:string;payment_page_url:string;payable_amount:number;fee_amount:number;status:string;expires_at:string;qris?:{image_data_url:string;qris_string:string;dynamic_amount:number;payable_amount:number;unique_code:string;admin_fee:number}|null}}>("/api/v1/payments",{method:"POST",headers:{"Idempotency-Key":input.reference},body:JSON.stringify({project_payment_ref:input.reference,amount:input.amount,currency:"IDR",description:input.description,payment_provider:"qris_dynamic",payment_mode:"qris",image_qris:true,customer:input.customer,items:input.items,redirect_url:input.finishUrl,finish_url:input.finishUrl,webhook_url:input.webhookUrl,expiry_minutes:input.expiryMinutes??10,metadata:{source:"amk-store"}})})}
  getPayment(id:string){return this.request<{success:boolean;data:{payment_id:string;project_payment_ref:string;amount:number;status:string;paid_at:string|null}}>(`/api/v1/payments/${encodeURIComponent(id)}`)}
  cancelPayment(id:string,reason:string){return this.request(`/api/v1/payments/${encodeURIComponent(id)}/cancel`,{method:"POST",body:JSON.stringify({reason})})}
  async verifyWebhook(raw:string,signature:string){const expected=await hmacHex(this.signatureSecret,raw);return constantTimeEqual(expected,signature.toLowerCase())}
}
