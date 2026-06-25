const Listing=require("./models/listing.js")
const Review=require("./models/review.js")
const ExpressError=require("./utils/ExpressError");
const { listingSchema, reviewSchema } = require("./schema.js");

module.exports.validateListing=(req,res,next)=>{
    if (req.body && req.body.listing) {
        if (req.body.listing.features) {
            if (!Array.isArray(req.body.listing.features)) {
                req.body.listing.features = [req.body.listing.features];
            }
        } else {
            req.body.listing.features = [];
        }
    }
    let {error}=listingSchema.validate(req.body);
    if(error)
        throw new ExpressError(400,error);
    else
        next();
}

module.exports.validateReview=(req,res,next)=>{
    let {error}=reviewSchema.validate(req.body);
    if(error)
        throw new ExpressError(400,error);
    else
        next();
}

module.exports.isLoggedIn=(req,res,next)=>{
    if(!req.isAuthenticated()){
    req.session.redirectUrl=req.originalUrl;
    req.flash("error","You must be logged in");
    return res.redirect("/login");
    }
    next();
};

module.exports.saveredirectUrl=(req,res,next)=>{
    if(req.session.redirectUrl){
        res.locals.redirectUrl=req.session.redirectUrl;
    }
    next();
}

module.exports.isOwner = async (req, res, next) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);

    if (!listing) {
        req.flash("error", "Listing not found");
        return res.redirect("/listings");
    }

    if (!listing.owner.equals(res.locals.currUser._id)) {
        req.flash("error", "You are not the owner of this listing");
        return res.redirect(`/listings/${id}`);
    }

    next();
};


module.exports.isReviewAuthor=async (req,res,next)=>{
    let {id,reviewId}=req.params;
    let review=await Review.findById(reviewId);
    if(!review.author._id.equals(res.locals.currUser._id)){
        req.flash("error","You are not the author of this review");
        return res.redirect(`/listings/${id}`);
    }
    next();
}


