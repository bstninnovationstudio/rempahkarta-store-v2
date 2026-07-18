import ShippingLabel from "./ShippingLabel";

export default function ShippingLabelExamplePage() {
  return (
    <main>
      <ShippingLabel
        data={{
          waybillId: "BTS100000106996",
          courierCompany: "SAP Express",
          courierService: "REG",
          routingCode: "SUB - WTS",
          codAmount: 0,
          isCod: false,
          totalQuantity: 1,
          totalWeightKg: 0.5,
          recipient: {
            name: "Budi Santoso",
            phone: "0812-3456-7890",
            address:
              "Jl. Ketintang Baru No. 18, Gayungan, Surabaya, Jawa Timur",
            postalCode: "60231",
          },
          sender: {
            name: "Gudang REMPAHKARTA",
            phone: "0813-0000-0000",
            address:
              "Jl. Industri Rempah No. 7, Sidoarjo, Jawa Timur",
            postalCode: "61254",
          },
          itemDescription: "Bumbu dan rempah kering kemasan",
          note: "Jangan ditindih. Hubungi penerima sebelum antar.",
          orderPublicNumber: "RK-20260718-001",
        }}
      />
    </main>
  );
}
