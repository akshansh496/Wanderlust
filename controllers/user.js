const User=require("../models/user.js");
const { userSchema, resetPasswordSchema } = require("../schema.js");
const crypto = require("crypto");
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const Review = require("../models/review.js");
const Payment = require("../models/payment.js");
const nodemailer = require("nodemailer");

module.exports.renderSignUpForm=(req,res)=>{
    res.render("users/signup.ejs");
}


module.exports.signup=async (req,res,next)=>{
    try{
        // Trim leading and trailing spaces
        if (req.body.username) req.body.username = req.body.username.trim();
        if (req.body.email) req.body.email = req.body.email.trim();

        const { error } = userSchema.validate(req.body);
        if (error) {
            req.flash("error", error.details[0].message);
            return res.redirect("/signup");
        }

        let {username,email,password}=req.body;

        // Check for duplicate email
        const existingEmail = await User.findOne({ email: email.toLowerCase() });
        if (existingEmail) {
            req.flash("error", "A user with this email is already registered.");
            return res.redirect("/signup");
        }

        const newUser=new User({email: email.toLowerCase(), username});
        const registeredUser=await  User.register(newUser,password);
        console.log(registeredUser);
        req.login(registeredUser,((err)=>{
            if(err){
                next(err);
            }
            req.flash("success","Welcome to Wanderlust");
            res.redirect("/listings");
        })
    )
    }
    catch(e){
        req.flash("error",e.message);
        res.redirect("/signup");
    }
}


module.exports.renderLoginForm=(req,res)=>{
    res.render("users/login.ejs");
}


module.exports.login=async (req,res)=>{
    req.flash("success","Welcome to Wanderlust");  
    // console.log(req.session.redirectUrl);
    let redirectUrl=res.locals.redirectUrl || "/listings";
    res.redirect(redirectUrl);
}


module.exports.logout=(req,res,next)=>{
    req.logOut((err)=>{
        if(err){
            next(err);
        }
        req.flash("success",`You are logged out!`);
        res.redirect("/listings");
    })
}


module.exports.renderProfileDashboard = async (req, res) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Auto-complete past stays
    await Booking.updateMany(
        { checkOutDate: { $lt: today }, bookingStatus: "Confirmed" },
        { bookingStatus: "Completed" }
    );

    let tab = req.query.tab || "info";
    let data = {};

    if (tab === "listings") {
        const myListings = await Listing.find({ owner: req.user._id });
        const hostBookings = await Booking.find({ host: req.user._id });
        
        const totalListings = myListings.length;
        const totalBookings = hostBookings.length;
        const pendingBookings = hostBookings.filter(b => b.bookingStatus === "Pending").length;
        const confirmedBookings = hostBookings.filter(b => b.bookingStatus === "Confirmed").length;
        const revenue = hostBookings
            .filter(b => ["Confirmed", "Completed"].includes(b.bookingStatus))
            .reduce((sum, b) => sum + b.totalPrice, 0);

        data = {
            myListings,
            totalListings,
            totalBookings,
            pendingBookings,
            confirmedBookings,
            revenue
        };
    } else if (tab === "bookings") {
        const myBookings = await Booking.find({ guest: req.user._id })
            .populate("listing")
            .populate("host")
            .sort({ checkInDate: -1 });

        data = {
            myBookings
        };
    } else if (tab === "requests") {
        const requests = await Booking.find({ host: req.user._id })
            .populate("listing")
            .populate("guest")
            .sort({ createdAt: -1 });

        const totalBookings = requests.length;
        const pendingRequests = requests.filter(r => r.bookingStatus === "Pending").length;
        const confirmedBookings = requests.filter(r => r.bookingStatus === "Confirmed").length;
        const revenue = requests
            .filter(r => ["Confirmed", "Completed"].includes(r.bookingStatus))
            .reduce((sum, r) => sum + r.totalPrice, 0);
        
        const myListings = await Listing.find({ owner: req.user._id });
        const listingIds = myListings.map(l => l._id);
        const occupiedTodayCount = await Booking.countDocuments({
            listing: { $in: listingIds },
            bookingStatus: "Confirmed",
            checkInDate: { $lte: today },
            checkOutDate: { $gte: today }
        });
        const occupancyRate = myListings.length > 0 
            ? Math.round((occupiedTodayCount / myListings.length) * 100) 
            : 0;

        data = {
            requests,
            totalBookings,
            pendingRequests,
            confirmedBookings,
            revenue,
            occupancyRate
        };
    } else if (tab === "reviews") {
        const hostListings = await Listing.find({ owner: req.user._id }).select("_id");
        const listingIds = hostListings.map(l => l._id);
        
        const reviewsReceived = await Review.find({ listing: { $in: listingIds } })
            .populate("author")
            .populate("listing")
            .sort({ created_at: -1 });

        const totalReviews = reviewsReceived.length;
        let averageRating = 0;
        let ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

        if (totalReviews > 0) {
            let sum = 0;
            reviewsReceived.forEach(r => {
                sum += r.rating;
                let ratingKey = Math.round(r.rating);
                if (ratingDistribution[ratingKey] !== undefined) {
                    ratingDistribution[ratingKey]++;
                }
            });
            averageRating = (sum / totalReviews).toFixed(1);
        }

        data = {
            reviewsReceived,
            totalReviews,
            averageRating,
            ratingDistribution
        };
    } else if (tab === "payments") {
        const myPayments = await Payment.find({ guest: req.user._id })
            .populate({
                path: "booking",
                populate: { path: "listing" }
            })
            .sort({ timestamp: -1 });

        data = {
            myPayments
        };
    } else if (tab === "host-dashboard") {
        const myListings = await Listing.find({ owner: req.user._id });
        const listingIds = myListings.map(l => l._id);

        const hostBookings = await Booking.find({ listing: { $in: listingIds } });
        const hostBookingsIds = hostBookings.map(b => b._id);

        const payments = await Payment.find({ booking: { $in: hostBookingsIds } }).populate({
            path: "booking",
            populate: { path: "listing" }
        });

        const successfulPayments = payments.filter(p => p.status === "Paid");
        const pendingPayments = payments.filter(p => p.status === "Pending");

        const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const monthlyRevenue = successfulPayments
            .filter(p => {
                const pDate = new Date(p.timestamp);
                return pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear;
            })
            .reduce((sum, p) => sum + p.amount, 0);

        const revenueByListingMap = {};
        myListings.forEach(l => {
            revenueByListingMap[l._id.toString()] = { title: l.title, revenue: 0 };
        });
        successfulPayments.forEach(p => {
            if (p.booking && p.booking.listing) {
                const lid = p.booking.listing._id.toString();
                if (revenueByListingMap[lid]) {
                    revenueByListingMap[lid].revenue += p.amount;
                }
            }
        });
        const revenueByListing = Object.values(revenueByListingMap);

        data = {
            totalRevenue,
            monthlyRevenue,
            successfulPaymentsCount: successfulPayments.length,
            pendingPaymentsCount: pendingPayments.length,
            revenueByListing,
            successfulPayments,
            pendingPayments
        };
    }

    res.render("users/profile.ejs", { tab, data });
};


module.exports.updateProfilePicture = async (req, res) => {
    // If a new file is uploaded, use it. Otherwise keep old or default.
    let profilePicture = req.user.profilePicture;
    
    if (req.file) {
        profilePicture = req.file.path; // Cloudinary URL
    } else if (req.body.profilePicture && req.body.profilePicture.trim()) {
        profilePicture = req.body.profilePicture.trim();
    }

    await User.findByIdAndUpdate(req.user._id, { profilePicture });
    req.flash("success", "Profile picture updated successfully!");
    res.redirect("/profile?tab=info");
};


module.exports.renderForgotPasswordForm = (req, res) => {
    res.render("users/forgot.ejs");
};


module.exports.sendPasswordResetLink = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        req.flash("error", "Email is required.");
        return res.redirect("/forgot-password");
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    const token = crypto.randomBytes(20).toString("hex");
    const expires = Date.now() + 20 * 60 * 1000; // 20 minutes expiration

    if (user) {
        user.resetPasswordToken = token;
        user.resetPasswordExpires = expires;
        await user.save();

        // 1. Log to console for easy local developer testing
        console.log("\n========================================================");
        console.log("PASSWORD RESET REQUEST RECEIVED:");
        console.log(`To: ${user.email}`);
        console.log(`Reset Link: http://localhost:8080/reset-password?token=${token}`);
        console.log("========================================================\n");

        // 2. Try sending mail using nodemailer if environment variables are set
        if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                const resetUrl = `http://localhost:8080/reset-password?token=${token}`;
                const mailOptions = {
                    to: user.email,
                    from: process.env.EMAIL_USER,
                    subject: "Wanderlust Password Reset Link",
                    html: `
                        <h3>Wanderlust Password Reset</h3>
                        <p>You requested a password reset for your Wanderlust account.</p>
                        <p>Please click on the link below to set a new password. The link will expire in 20 minutes:</p>
                        <p><a href="${resetUrl}">${resetUrl}</a></p>
                        <p>If you did not request this, please ignore this email.</p>
                    `
                };

                await transporter.sendMail(mailOptions);
                console.log("Password reset email sent successfully via Nodemailer.");
            } catch (err) {
                console.error("Nodemailer failed to send email:", err);
            }
        }
    } else {
        // Log to console so developer knows reset was triggered for non-existent email
        console.log(`\nPassword reset requested for non-registered email: ${email.trim().toLowerCase()}\n`);
    }

    req.flash("success", "If that email address is registered, a password reset link has been sent.");
    res.redirect("/login");
};


module.exports.renderResetPasswordForm = async (req, res) => {
    const { token } = req.query;
    if (!token) {
        req.flash("error", "Invalid or missing password reset token.");
        return res.redirect("/forgot-password");
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        req.flash("error", "Password reset token is invalid or has expired.");
        return res.redirect("/forgot-password");
    }

    res.render("users/reset.ejs", { token });
};


module.exports.resetPassword = async (req, res, next) => {
    const { token, password, confirmPassword } = req.body;

    const { error } = resetPasswordSchema.validate(req.body);
    if (error) {
        req.flash("error", error.details[0].message);
        return res.redirect(`/reset-password?token=${token}`);
    }

    const user = await User.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
        req.flash("error", "Password reset token is invalid or has expired.");
        return res.redirect("/forgot-password");
    }

    // Set new password
    user.setPassword(password, async (err) => {
        if (err) {
            return next(err);
        }
        
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        req.flash("success", "Password reset successfully! You can now log in.");
        res.redirect("/login");
    });
};
