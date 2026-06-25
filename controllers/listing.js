const Listing=require("../models/listing.js");
const Booking=require("../models/booking.js");
const featuresList = require("../utils/features.js");
const categoriesList = require("../utils/categories.js");
const calculateTax = require("../utils/taxCalculator.js");

module.exports.index=async (req,res)=>{
    let { search, category, features } = req.query;
    let query = {};

    // 1. Category filter
    if (category) {
        query.category = category;
    }

    // 2. Features filter (AND logic)
    if (features) {
        const featureList = features.split(",").map(f => f.trim()).filter(Boolean);
        if (featureList.length > 0) {
            query.features = { $all: featureList };
        }
    }

    // 3. Search filter
    if (search) {
        const searchRegex = new RegExp(search.trim(), "i");
        query.$or = [
            { title: searchRegex },
            { location: searchRegex },
            { country: searchRegex },
            { description: searchRegex },
            { category: searchRegex }
        ];
    }

    const allListings=await Listing.find(query).populate("reviews");
    
    // Dynamic availability status calculation
    const today = new Date();
    today.setHours(0,0,0,0);
    const nextMonth = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    for (let listing of allListings) {
        const occupiedToday = await Booking.findOne({
            listing: listing._id,
            bookingStatus: "Confirmed",
            checkInDate: { $lte: today },
            checkOutDate: { $gte: today }
        });
        
        if (occupiedToday) {
            listing.availabilityStatus = "Fully Booked";
        } else {
            const upcoming = await Booking.findOne({
                listing: listing._id,
                bookingStatus: { $in: ["Confirmed", "Pending"] },
                checkInDate: { $lte: nextMonth },
                checkOutDate: { $gte: today }
            });
            
            if (upcoming) {
                listing.availabilityStatus = "Limited Availability";
            } else {
                listing.availabilityStatus = "Available";
            }
        }
    }

    res.render("./listings/index.ejs",{
        allListings,
        search: search || "",
        category: category || "",
        activeFeatures: features || "",
        featuresList,
        categoriesList,
        calculateTax
    });
};


module.exports.renderNewForm=(req,res)=>{
    res.render("./listings/new.ejs", { categoriesList, featuresList });
};


module.exports.createListing=async (req,res,next)=>{
    let url=req.file.path;
    let filename=req.file.filename;
    const newListing=new Listing(req.body.listing);
    newListing.owner=req.user._id;
    newListing.image={url,filename};
    await newListing.save();
    req.flash("success","New Listing Created!")
    res.redirect("/listings")
};


module.exports.showListing=async (req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id)
    .populate({
        path:"reviews",
        populate:{
            path:"author",
        },
    })
    .populate("owner");
    if(!listing){
        req.flash("error","Listing doesn't exist!");
        return res.redirect("/listings");
    }

    // Auto-complete past stays for this listing
    const today = new Date();
    today.setHours(0,0,0,0);
    await Booking.updateMany(
        { listing: id, checkOutDate: { $lt: today }, bookingStatus: "Confirmed" },
        { bookingStatus: "Completed" }
    );

    let bookingStatusForUser = "none";
    let eligibleBookingId = null;

    if (req.user) {
        const userBookings = await Booking.find({
            listing: id,
            guest: req.user._id
        }).sort({ checkOutDate: -1 });

        if (userBookings.length > 0) {
            const hasCompleted = userBookings.some(b => b.bookingStatus === "Completed");
            if (hasCompleted) {
                const unreviewedBooking = userBookings.find(b => b.bookingStatus === "Completed" && !b.reviewSubmitted);
                if (unreviewedBooking) {
                    bookingStatusForUser = "eligible";
                    eligibleBookingId = unreviewedBooking._id;
                } else {
                    bookingStatusForUser = "reviewed";
                }
            } else {
                bookingStatusForUser = "pending_stay";
            }
        }
    }

    res.render("./listings/show.ejs",{
        listing, 
        featuresList, 
        calculateTax,
        bookingStatusForUser,
        eligibleBookingId
    });
};


module.exports.renderEditForm=async (req,res)=>{
    let {id}=req.params;
    const listing=await Listing.findById(id);
    if(!listing){
        req.flash("error","Listing doesn't exist!");
        res.redirect("/listings");
    }
    let originalImageUrl=listing.image.url;
    originalImageUrl=originalImageUrl.replace("/upload","/upload/h_300,w_250")
    res.render("./listings/edit.ejs",{listing,originalImageUrl, categoriesList, featuresList});
};


module.exports.updateListing=async(req,res)=>{
    let {id}=req.params;
    if (req.body.listing) {
        if (req.body.listing.features) {
            if (!Array.isArray(req.body.listing.features)) {
                req.body.listing.features = [req.body.listing.features];
            }
        } else {
            req.body.listing.features = [];
        }
    }
    let listing=await Listing.findByIdAndUpdate(id,{ ...req.body.listing });
    if(typeof req.file!=="undefined"){
        let url=req.file.path;
        let filename=req.file.filename;
        listing.image={url,filename};
        await listing.save();
    }
    req.flash("success","Listing Edited!")
    res.redirect(`/listings/${id}`);
}


module.exports.destroyListing=async (req,res)=>{
    let {id}=req.params;
    
    // Check if active or scheduled bookings exist
    const activeBooking = await Booking.findOne({
        listing: id,
        bookingStatus: { $in: ["Pending", "Confirmed"] }
    });
    if (activeBooking) {
        req.flash("error", "Cannot delete this property because active or scheduled bookings exist.");
        return res.redirect(`/listings/${id}`);
    }

    const DeletedChat=await Listing.findByIdAndDelete(id);
    console.log(DeletedChat);
    req.flash("success","Listing deleted!")
    res.redirect("/listings");
}