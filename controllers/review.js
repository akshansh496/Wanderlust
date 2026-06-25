const Review=require("../models/review.js");
const Listing=require("../models/listing.js");
const Booking=require("../models/booking.js");

module.exports.createReview=async (req,res)=>{
    const listingId = req.params.id;
    const { bookingId } = req.body.review;
    
    if (!bookingId) {
        req.flash("error", "Invalid booking reference. You must have a completed stay to review this property.");
        return res.redirect(`/listings/${listingId}`);
    }

    const booking = await Booking.findById(bookingId);
    if (!booking || !booking.guest.equals(req.user._id) || !booking.listing.equals(listingId)) {
        req.flash("error", "Booking stay not found or unauthorized.");
        return res.redirect(`/listings/${listingId}`);
    }

    if (booking.bookingStatus !== "Completed") {
        req.flash("error", "You can only review a listing after your stay is completed.");
        return res.redirect(`/listings/${listingId}`);
    }

    if (booking.reviewSubmitted) {
        req.flash("error", "You have already submitted a review for this booking stay.");
        return res.redirect(`/listings/${listingId}`);
    }

    let listing=await Listing.findById(listingId);
    let newReview=new Review(req.body.review);
    newReview.author=req.user._id;
    newReview.listing=listingId;
    newReview.booking=bookingId;
    newReview.verifiedStay=true;
    
    listing.reviews.push(newReview);
    booking.reviewSubmitted = true;

    await newReview.save();
    await booking.save();
    await listing.save();
    
    req.flash("success","New review added! ✓ Verified Stay")
    res.redirect(`/profile?tab=bookings`);
};


module.exports.destroyReview=async (req,res)=>{
    let {id,reviewId}=req.params;
    await Review.findByIdAndDelete(reviewId);
    await Listing.findByIdAndUpdate(id, {$pull : {reviews:reviewId}});
    req.flash("success","Review deleted!")
    res.redirect(`/listings/${id}`)
};


module.exports.updateReview=async (req,res)=>{
    let {id,reviewId}=req.params;
    await Review.findByIdAndUpdate(reviewId, { ...req.body.review });
    req.flash("success","Review updated successfully!")
    res.redirect(`/profile?tab=bookings`);
};