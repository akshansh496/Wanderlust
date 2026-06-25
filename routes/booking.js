const express = require("express");
const router = express.Router({ mergeParams: true });
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");
const bookingController = require("../controllers/booking.js");

// Route to create a new booking
router.post("/", isLoggedIn, wrapAsync(bookingController.createBooking));

// Route to check availability of dates for a listing (AJAX/API endpoint)
router.get("/check-availability", wrapAsync(bookingController.checkAvailability));

// Route for hosts to accept/reject booking status
router.post("/:bookingId/status", isLoggedIn, wrapAsync(bookingController.updateBookingStatus));

// Route for guests to cancel bookings
router.post("/:bookingId/cancel", isLoggedIn, wrapAsync(bookingController.cancelBooking));

// Route to render checkout page
router.get("/:bookingId/checkout", isLoggedIn, wrapAsync(bookingController.checkoutBooking));

// Route to verify payment signature
router.post("/:bookingId/verify", isLoggedIn, wrapAsync(bookingController.verifyPayment));

// Route to retry payment
router.post("/:bookingId/retry", isLoggedIn, wrapAsync(bookingController.retryPayment));

// Route to render booking invoice receipt
router.get("/:bookingId/receipt", isLoggedIn, wrapAsync(bookingController.renderReceipt));

module.exports = router;
