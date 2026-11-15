// app/lib/gtin.ts
//
// GTIN/EAN sağlama basamağı doğrulaması (GTIN-8/12/13/14): ağırlıklar sağdan 3,1,3,1...
// Hepsiburada ürünü barkodla tanıdığı için yanlış/iç kod barkodları (ör. 8 haneli mağaza kodu) kullanılmamalı.

export function isValidGtin(value: string): boolean {
  if (!/^\d+$/.test(value) || ![8, 12, 13, 14].includes(value.length)) return false;

  const digits = value.split("").map(Number);
  const check = digits.pop() as number;
  let sum = 0;

  digits.reverse().forEach((digit, index) => {
    sum += digit * (index % 2 === 0 ? 3 : 1);
  });

  return (10 - (sum % 10)) % 10 === check;
}
