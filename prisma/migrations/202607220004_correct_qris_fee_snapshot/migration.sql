-- BSTN Payment.feeAmount mencakup fee QRIS dan kode unik. RevenueLedger.adminFee
-- hanya menyimpan fee QRIS bersih agar rincian settlement tidak menghitung kode
-- unik sebagai biaya provider.
UPDATE `RevenueLedger` rl
SET rl.`adminFee` = GREATEST(0, rl.`adminFee` - rl.`uniqueCode`)
WHERE rl.`orderId` IS NOT NULL
  AND rl.`adminFee` > 0
  AND rl.`uniqueCode` > 0;
