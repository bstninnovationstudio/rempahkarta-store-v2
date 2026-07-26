

export type ProductFormVariant = {
  id?: string;
  sku: string;
  option1Value: string | null;
  option2Value: string | null;
  price: number;
  stock: number;
  reserved: number;
  weight: number;
  length: number | null;
  width: number | null;
  height: number | null;
  lowStockThreshold: number;
  active: boolean;
  imageKey?: string | null;
};

export type ProductFormInitial = {
  id?: string;
  name: string;
  categoryId: string | null;
  description: string;
  status: "draft" | "active" | "archived";
  hasVariants: boolean;
  option1Name: string;
  option2Name: string;
  images: string[];
  variants: ProductFormVariant[];
  shopeeLink?: string | null;
  tiktokLink?: string | null;
  tokopediaLink?: string | null;
  rating?: number;
  sold?: number;
};

export async function getCategoryOptions() {

  const { prisma } = await import("@/lib/db");
  return prisma.productCategory.findMany({ select: { id: true, name: true }, orderBy: [{ position: "asc" }, { id: "asc" }] });
}

export async function getProductForEdit(id: string): Promise<ProductFormInitial | null> {

  const { prisma } = await import("@/lib/db");
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      images: { orderBy: { position: "asc" } },
      variants: { where: { active: true }, orderBy: { position: "asc" }, include: { inventory: { orderBy: { id: "asc" } } } },
    },
  });
  if (!product) return null;
  const variants = product.variants.map(item => {
    const inventory = item.inventory[0];
    return {
      id: item.id,
      sku: item.sku,
      option1Value: item.option1Value,
      option2Value: item.option2Value,
      price: Number(item.price),
      stock: inventory?.onHand ?? 0,
      reserved: inventory?.reserved ?? 0,
      weight: item.weight,
      length: item.length,
      width: item.width,
      height: item.height,
      lowStockThreshold: item.lowStockThreshold,
      active: item.active,
      imageKey: item.imageKey,
    };
  });
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    description: product.description,
    status: product.status,
    hasVariants: product.hasVariants,
    option1Name: product.option1Name ?? "",
    option2Name: product.option2Name ?? "",
    images: product.images.map(item => item.objectKey),
    variants: variants.length ? variants : [{ sku: "", option1Value: null, option2Value: null, price: 0, stock: 0, reserved: 0, weight: 100, length: null, width: null, height: null, lowStockThreshold: 5, active: true, imageKey: null }],
    shopeeLink: product.shopeeLink,
    tiktokLink: product.tiktokLink,
    tokopediaLink: product.tokopediaLink,
    rating: Number(product.rating),
    sold: product.sold,
  };
}

export async function getProductForDuplicate(id: string): Promise<ProductFormInitial | null> {
  const source = await getProductForEdit(id);
  if (!source) return null;
  const suffix = `COPY-${Date.now().toString(36).toUpperCase()}`;
  const skuWithSuffix = (sku: string) => `${sku.slice(0, Math.max(2, 80 - suffix.length - 1))}-${suffix}`;
  return {
    ...source,
    id: undefined,
    name: `${source.name.slice(0, 165)} (Salinan)`,
    status: "draft",
    rating: 0,
    sold: 0,
    variants: source.variants.map(variant => ({
      ...variant,
      id: undefined,
      sku: skuWithSuffix(variant.sku),
      stock: 0,
      reserved: 0,
      active: true,
    })),
  };
}

export const emptyProduct: ProductFormInitial = {
  name: "",
  categoryId: null,
  description: "",
  status: "draft",
  hasVariants: false,
  option1Name: "",
  option2Name: "",
  images: [],
  variants: [{ sku: "", option1Value: null, option2Value: null, price: 0, stock: 0, reserved: 0, weight: 100, length: null, width: null, height: null, lowStockThreshold: 5, active: true, imageKey: null }],
  shopeeLink: "",
  tiktokLink: "",
  tokopediaLink: "",
  rating: 5.0,
  sold: 0,
};
