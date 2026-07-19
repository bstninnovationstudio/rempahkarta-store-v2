import type { AdminOrder, Product } from "./types";

const rawProducts = [
  { id:"prd_01",variantId:"var_shinan_white_m",slug:"kayu-manis-premium",name:"Kayu Manis Premium",category:"Rempah Utuh",price:29000,compareAt:35000,image:"/demo/banner.webp",color:"Batang pilihan",rating:4.9,sold:124,tag:"Pilihan REMPAHKARTA",description:"Kayu manis beraroma hangat, dipilih dan dikemas untuk menjaga kesegarannya.",material:"Kayu manis utuh",care:["Simpan tertutup rapat","Hindari tempat lembap","Jauhkan dari sinar matahari langsung"],sizes:["100 g","250 g"],stock:18 },
  { id:"prd_02",variantId:"var_aruna_sky_m",slug:"cengkeh-utuh",name:"Cengkeh Utuh",category:"Rempah Utuh",price:35000,compareAt:42000,image:"/demo/banner.webp",color:"Utuh",rating:4.8,sold:86,tag:"Aroma kuat",description:"Cengkeh utuh dengan aroma tajam dan warna alami untuk masakan serta minuman rempah.",material:"Cengkeh kering utuh",care:["Simpan di tempat kering","Tutup kemasan setelah digunakan"],sizes:["100 g","250 g"],stock:12 },
  { id:"prd_03",variantId:"var_nawasena_navy_m",slug:"kapulaga-hijau",name:"Kapulaga Hijau",category:"Rempah Utuh",price:42000,compareAt:49000,image:"/demo/banner.webp",color:"Hijau pilihan",rating:5,sold:41,tag:"Premium",description:"Kapulaga hijau pilihan dengan karakter segar untuk racikan minuman dan masakan.",material:"Kapulaga hijau utuh",care:["Simpan kedap udara","Gunakan sendok kering"],sizes:["50 g","100 g"],stock:7 },
  { id:"prd_04",slug:"pala-utuh",name:"Pala Utuh",category:"Rempah Utuh",price:33000,compareAt:39000,image:"/demo/banner.webp",color:"Utuh",rating:4.7,sold:97,description:"Biji pala utuh dengan aroma hangat untuk masakan, kue, dan minuman tradisional.",material:"Biji pala pilihan",care:["Simpan di wadah tertutup","Parut secukupnya saat digunakan"],sizes:["100 g","250 g"],stock:22 },
  { id:"prd_05",slug:"lada-hitam-butiran",name:"Lada Hitam Butiran",category:"Rempah Utuh",price:28000,image:"/demo/banner.webp",color:"Butiran",rating:4.8,sold:53,description:"Lada hitam butiran dengan rasa pedas hangat dan aroma yang tetap terjaga.",material:"Lada hitam utuh",care:["Giling saat akan digunakan","Simpan di tempat sejuk dan kering"],sizes:["100 g","250 g"],stock:14 },
  { id:"prd_06",slug:"bunga-lawang",name:"Bunga Lawang",category:"Rempah Utuh",price:31000,compareAt:37000,image:"/demo/banner.webp",color:"Utuh",rating:4.9,sold:32,description:"Bunga lawang utuh dengan aroma manis khas untuk kaldu, minuman, dan racikan rempah.",material:"Bunga lawang kering",care:["Simpan tertutup rapat","Hindari kelembapan"],sizes:["50 g","100 g"],stock:9 },
] as const;

export const products: Product[] = rawProducts.map((item, productIndex) => ({
  ...item,
  care: [...item.care], sizes: [...item.sizes], images: [item.image], hasVariants: true, option1Name: "Berat Bersih",
  variants: item.sizes.map((size, sizeIndex) => ({ id: sizeIndex === 0 && "variantId" in item ? item.variantId : `demo-${productIndex}-${sizeIndex}`, sku: `RMP-DEMO-${productIndex + 1}-${size.replace(/\s/g, "")}`, option1Value: size, price: item.price + sizeIndex * Math.round(item.price * .8), compareAt: "compareAt" in item ? item.compareAt : undefined, stock: Math.max(0, Math.floor(item.stock / item.sizes.length)), weight: Number.parseInt(size) + 20 })),
}));

export const adminOrders: AdminOrder[] = [
  { number:"ORD-20260713-8F3K",customer:"Budi S••••••",createdAt:"13 Jul, 09:42",total:38000,payment:"paid",fulfillment:"awaiting_processing",courier:"JNE REG",sla:"3j 18m",item:"Kayu Manis Premium",image:"/demo/banner.webp" },
  { number:"ORD-20260713-4A7M",customer:"Rizky P••••",createdAt:"13 Jul, 09:18",total:51000,payment:"paid",fulfillment:"processing",courier:"JNE REG",sla:"5j 02m",item:"Kapulaga Hijau",image:"/demo/banner.webp" },
  { number:"ORD-20260712-9N2Q",customer:"Alif R••••",createdAt:"12 Jul, 20:05",total:44000,payment:"paid",fulfillment:"handover_pending",courier:"JNE REG",sla:"Menunggu pickup",item:"Cengkeh Utuh",image:"/demo/banner.webp" },
  { number:"ORD-20260712-2K8D",customer:"Farhan A••••",createdAt:"12 Jul, 16:24",total:40000,payment:"paid",fulfillment:"in_transit",courier:"JNE REG",sla:"Dalam perjalanan",item:"Bunga Lawang",image:"/demo/banner.webp" },
  { number:"ORD-20260712-7C1J",customer:"Dimas H••••",createdAt:"12 Jul, 11:40",total:37000,payment:"refund_pending",fulfillment:"cancelled",courier:"—",sla:"Tinjau refund",item:"Lada Hitam Butiran",image:"/demo/banner.webp" },
];

export const demoOrder = adminOrders[0];
