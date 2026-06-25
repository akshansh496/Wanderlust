const express=require("express");
const router=express.Router({mergeParams:true});
const wrapAsync=require("../utils/wrapAsync.js");
const ExpressError=require("../utils/ExpressError");
const Review=require("../models/review.js");
const {validateReview, isLoggedIn,isReviewAuthor}=require("../middleware.js");
const reviewController=require("../controllers/review.js")



//Reviews Route
router.post("/",isLoggedIn,validateReview,wrapAsync(reviewController.createReview)
);

//Delete Review Route
router.delete("/:reviewId",isLoggedIn,isReviewAuthor,wrapAsync(reviewController.destroyReview));

//Update Review Route
router.put("/:reviewId",isLoggedIn,isReviewAuthor,wrapAsync(reviewController.updateReview));


module.exports=router;