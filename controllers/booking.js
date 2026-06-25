const Booking = require("../models/booking.js");
const Listing = require("../models/listing.js");
const Payment = require("../models/payment.js");
const calculateTaxBreakdown = require("../utils/taxCalculator.js");
const Razorpay = require("razorpay");
const crypto = require("crypto");

// Razorpay instance
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret"
});

// 1. Create a booking request
module.exports.createBooking = async (req, res) => {
    let { id } = req.params;
    let { checkInDate, checkOutDate, guestCount } = req.body.booking;

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    
    // Validation: checkIn must be in the future, checkOut must be after checkIn
    const today = new Date();
    today.setHours(0,0,0,0);
    
    if (checkIn < today) {
        req.flash("error", "Check-in date cannot be in the past.");
        return res.redirect(`/listings/${id}`);
    }
    if (checkOut <= checkIn) {
        req.flash("error", "Check-out date must be after check-in date.");
        return res.redirect(`/listings/${id}`);
    }

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash("error", "Listing not found.");
        return res.redirect("/listings");
    }

    // Prevent host from booking their own listing
    if (listing.owner.equals(req.user._id)) {
        req.flash("error", "You cannot book your own listing.");
        return res.redirect(`/listings/${id}`);
    }

    // Prevent double booking (Check overlapping Confirmed or Completed stays)
    const overlapping = await Booking.findOne({
        listing: id,
        bookingStatus: { $in: ["Confirmed", "Completed"] },
        $or: [
            {
                checkInDate: { $lt: checkOut },
                checkOutDate: { $gt: checkIn }
            }
        ]
    });

    if (overlapping) {
        req.flash("error", "The property is unavailable for the selected dates.");
        return res.redirect(`/listings/${id}`);
    }

    // Calculate total price based on correct GST formula
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    const nightsCount = Math.ceil((checkOut - checkIn) / millisecondsPerDay);
    const basePrice = listing.price * nightsCount;
    const pricing = calculateTaxBreakdown(basePrice);
    const totalPrice = pricing.total;

    const newBooking = new Booking({
        listing: id,
        guest: req.user._id,
        host: listing.owner,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestCount: parseInt(guestCount),
        totalPrice: totalPrice,
        bookingStatus: "Pending",
        paymentStatus: "Pending"
    });

    // Create Razorpay Order
    let razorpayOrderId = "";
    try {
        const orderOptions = {
            amount: Math.round(totalPrice * 100), // in paise
            currency: "INR",
            receipt: newBooking._id.toString()
        };
        const order = await razorpay.orders.create(orderOptions);
        razorpayOrderId = order.id;
        newBooking.razorpayOrderId = razorpayOrderId;
    } catch (err) {
        console.error("Razorpay order creation failed:", err);
        // Fallback for development/offline test if keys are missing
        razorpayOrderId = "order_offline_" + Math.random().toString(36).substr(2, 9);
        newBooking.razorpayOrderId = razorpayOrderId;
    }

    await newBooking.save();

    // Log the transaction in Payment collection
    const newPayment = new Payment({
        booking: newBooking._id,
        guest: req.user._id,
        razorpayOrderId: razorpayOrderId,
        amount: totalPrice,
        status: "Pending"
    });
    await newPayment.save();

    // Redirect user to checkout/payment page
    res.redirect(`/listings/${id}/bookings/${newBooking._id}/checkout`);
};

// 2. Check dates availability (API / AJAX endpoint)
module.exports.checkAvailability = async (req, res) => {
    let { id } = req.params;
    let { checkInDate, checkOutDate } = req.query;

    if (!checkInDate || !checkOutDate) {
        return res.json({ status: "invalid", message: "Please select both check-in and check-out dates." });
    }

    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    if (isNaN(checkIn) || isNaN(checkOut) || checkOut <= checkIn) {
        return res.json({ status: "invalid", message: "Invalid date range selected." });
    }

    // Check overlaps with Confirmed/Completed
    const occupied = await Booking.findOne({
        listing: id,
        bookingStatus: { $in: ["Confirmed", "Completed"] },
        $or: [
            {
                checkInDate: { $lt: checkOut },
                checkOutDate: { $gt: checkIn }
            }
        ]
    });

    if (occupied) {
        return res.json({ status: "unavailable", message: "Unavailable for Selected Dates" });
    }

    // Check overlaps with Pending requests (where payment has not failed)
    const pending = await Booking.findOne({
        listing: id,
        bookingStatus: "Pending",
        paymentStatus: { $ne: "Failed" },
        $or: [
            {
                checkInDate: { $lt: checkOut },
                checkOutDate: { $gt: checkIn }
            }
        ]
    });

    if (pending) {
        return res.json({ status: "pending", message: "Pending Approval" });
    }

    return res.json({ status: "available", message: "Available" });
};

// 3. Render booking checkout payment page
module.exports.checkoutBooking = async (req, res) => {
    const { id, bookingId } = req.params;
    const booking = await Booking.findById(bookingId).populate("listing");
    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect(`/listings/${id}`);
    }

    // Security: Check if current user is the guest
    if (!booking.guest.equals(req.user._id)) {
        req.flash("error", "Unauthorized access.");
        return res.redirect(`/listings/${id}`);
    }

    const nights = Math.ceil((booking.checkOutDate - booking.checkInDate) / (24 * 60 * 60 * 1000));
    const basePrice = booking.listing.price * nights;
    const pricing = calculateTaxBreakdown(basePrice);

    res.render("bookings/checkout.ejs", {
        booking,
        pricing,
        nights,
        razorpayKeyId: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
        failed: req.query.failed === "true" || booking.paymentStatus === "Failed",
        cancelled: req.query.cancelled === "true"
    });
};

// 4. Verify Payment Signature
module.exports.verifyPayment = async (req, res) => {
    const { id, bookingId } = req.params;
    const { razorpay_payment_id, razorpay_signature, razorpay_order_id } = req.body;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect(`/listings/${id}`);
    }

    let isValid = false;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (key_secret && razorpay_payment_id && razorpay_signature && razorpay_order_id) {
        const hmac = crypto.createHmac("sha256", key_secret);
        hmac.update(razorpay_order_id + "|" + razorpay_payment_id);
        const generated_signature = hmac.digest("hex");
        
        if (generated_signature === razorpay_signature) {
            isValid = true;
        }
    } else {
        // Auto-approve in development if key is missing/placeholder
        if (!key_secret || key_secret === "placeholder_secret") {
            console.log("No Razorpay credentials set, auto-verifying payment in development mode.");
            isValid = true;
        }
    }

    const payment = await Payment.findOne({ booking: bookingId });

    if (isValid) {
        booking.bookingStatus = "Confirmed";
        booking.paymentStatus = "Paid";
        booking.razorpayPaymentId = razorpay_payment_id || "pay_placeholder_" + Date.now();
        booking.razorpaySignature = razorpay_signature || "sig_placeholder_" + Date.now();
        booking.paymentTimestamp = new Date();
        await booking.save();

        if (payment) {
            payment.status = "Paid";
            payment.razorpayPaymentId = booking.razorpayPaymentId;
            payment.razorpaySignature = booking.razorpaySignature;
            payment.timestamp = new Date();
            await payment.save();
        }

        req.flash("success", "Payment successful! Your booking is confirmed.");
        res.redirect("/profile?tab=bookings");
    } else {
        booking.bookingStatus = "Cancelled";
        booking.paymentStatus = "Failed";
        await booking.save();

        if (payment) {
            payment.status = "Failed";
            await payment.save();
        }

        req.flash("error", "Payment verification failed. Please try again.");
        res.redirect(`/listings/${id}/bookings/${bookingId}/checkout?failed=true`);
    }
};

// 5. Retry Payment
module.exports.retryPayment = async (req, res) => {
    const { id, bookingId } = req.params;
    const booking = await Booking.findById(bookingId);
    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect("/profile?tab=bookings");
    }

    try {
        const orderOptions = {
            amount: Math.round(booking.totalPrice * 100),
            currency: "INR",
            receipt: booking._id.toString()
        };
        const order = await razorpay.orders.create(orderOptions);
        
        booking.razorpayOrderId = order.id;
        booking.paymentStatus = "Pending";
        booking.bookingStatus = "Pending";
        await booking.save();

        await Payment.findOneAndUpdate(
            { booking: bookingId },
            { razorpayOrderId: order.id, status: "Pending" },
            { upsert: true }
        );
    } catch (err) {
        console.error("Razorpay retry order creation failed:", err);
        const orderId = "order_offline_" + Math.random().toString(36).substr(2, 9);
        booking.razorpayOrderId = orderId;
        booking.paymentStatus = "Pending";
        booking.bookingStatus = "Pending";
        await booking.save();

        await Payment.findOneAndUpdate(
            { booking: bookingId },
            { razorpayOrderId: orderId, status: "Pending" },
            { upsert: true }
        );
    }

    res.redirect(`/listings/${id}/bookings/${bookingId}/checkout`);
};

// 6. Accept or reject booking (Host action)
module.exports.updateBookingStatus = async (req, res) => {
    let { bookingId } = req.params;
    let { status } = req.body; // "Confirmed" or "Rejected"

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect("/profile?tab=requests");
    }

    // Verify user is host
    if (!booking.host.equals(req.user._id)) {
        req.flash("error", "Unauthorized action.");
        return res.redirect("/listings");
    }

    if (status === "Confirmed") {
        // Double-check overlap
        const overlapping = await Booking.findOne({
            _id: { $ne: bookingId },
            listing: booking.listing,
            bookingStatus: { $in: ["Confirmed", "Completed"] },
            $or: [
                {
                    checkInDate: { $lt: booking.checkOutDate },
                    checkOutDate: { $gt: booking.checkInDate }
                }
            ]
        });

        if (overlapping) {
            req.flash("error", "Cannot approve request. Overlaps with an already confirmed booking.");
            return res.redirect("/profile?tab=requests");
        }

        // Auto-reject other overlapping requests
        await Booking.updateMany(
            {
                _id: { $ne: bookingId },
                listing: booking.listing,
                bookingStatus: "Pending",
                $or: [
                    {
                        checkInDate: { $lt: booking.checkOutDate },
                        checkOutDate: { $gt: booking.checkInDate }
                    }
                ]
            },
            { bookingStatus: "Rejected" }
        );
    }

    booking.bookingStatus = status;
    await booking.save();
    
    req.flash("success", `Booking request ${status.toLowerCase()} successfully!`);
    res.redirect("/profile?tab=requests");
};

// 7. Cancel booking (Guest action)
module.exports.cancelBooking = async (req, res) => {
    let { bookingId } = req.params;

    const booking = await Booking.findById(bookingId);
    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect("/profile?tab=bookings");
    }

    // Verify user is guest
    if (!booking.guest.equals(req.user._id)) {
        req.flash("error", "Unauthorized action.");
        return res.redirect("/listings");
    }

    if (booking.bookingStatus === "Cancelled" || booking.bookingStatus === "Rejected" || booking.bookingStatus === "Completed") {
        req.flash("error", "This booking cannot be cancelled.");
        return res.redirect("/profile?tab=bookings");
    }

    booking.bookingStatus = "Cancelled";
    await booking.save();

    req.flash("success", "Booking cancelled successfully.");
    res.redirect("/profile?tab=bookings");
};

// 8. Render Booking Receipt
module.exports.renderReceipt = async (req, res) => {
    const { bookingId } = req.params;
    const booking = await Booking.findById(bookingId)
        .populate("listing")
        .populate("guest")
        .populate("host");
        
    if (!booking) {
        req.flash("error", "Booking not found.");
        return res.redirect("/profile?tab=bookings");
    }

    // Verify user is guest or host
    if (!booking.guest._id.equals(req.user._id) && !booking.host._id.equals(req.user._id)) {
        req.flash("error", "Unauthorized access.");
        return res.redirect("/listings");
    }

    const payment = await Payment.findOne({ booking: bookingId, status: "Paid" });

    const nights = Math.ceil((booking.checkOutDate - booking.checkInDate) / (24 * 60 * 60 * 1000));
    const basePrice = booking.listing.price * nights;
    const pricing = calculateTaxBreakdown(basePrice);

    res.render("bookings/receipt.ejs", {
        booking,
        payment,
        nights,
        pricing
    });
};
