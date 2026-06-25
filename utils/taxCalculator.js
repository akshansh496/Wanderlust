function calculateTaxBreakdown(basePrice) {
    const platformFeePercent = 0.05; // 5% platform fee
    const gstPercent = 0.18; // 18% GST on base price
    const serviceCharge = 0.00; // Flat service charge or 0

    const platformFee = Number((basePrice * platformFeePercent).toFixed(2));
    const gst = Number((basePrice * gstPercent).toFixed(2));
    const total = Number((basePrice + platformFee + gst + serviceCharge).toFixed(2));

    return {
        basePrice: Number(basePrice.toFixed(2)),
        platformFee,
        gst,
        serviceCharge,
        total
    };
}

module.exports = calculateTaxBreakdown;
