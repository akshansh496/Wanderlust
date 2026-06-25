const express=require("express");
const router=express.Router({mergeParams:true});

const wrapAsync = require("../utils/wrapAsync");
const passport = require("passport");
const { saveredirectUrl, isLoggedIn } = require("../middleware.js");
const userController=require("../controllers/user.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ 
    storage, 
    limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});


router
    .route("/signup")
    .get(userController.renderSignUpForm)
    .post(wrapAsync(userController.signup)
);


router  
    .route("/login")
    .get(userController.renderLoginForm)
    .post(
    saveredirectUrl,
    passport.authenticate("local", { failureRedirect: '/login', failureFlash: true })
    ,wrapAsync(userController.login)
);


router.get("/logout",userController.logout);

// User Profile Dashboard Route
router.get("/profile", isLoggedIn, wrapAsync(userController.renderProfileDashboard));

// User Profile Picture Update Route
router.post("/profile/update-picture", isLoggedIn, (req, res, next) => {
    upload.single('profilePicture')(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            req.flash("error", "File upload error: File size limit exceeded (Max 2MB).");
            return res.redirect("/profile?tab=info");
        } else if (err) {
            req.flash("error", "File upload failed: " + err.message);
            return res.redirect("/profile?tab=info");
        }
        next();
    });
}, wrapAsync(userController.updateProfilePicture));

// Forgot Password Routes
router.get("/forgot-password", userController.renderForgotPasswordForm);
router.post("/forgot-password", wrapAsync(userController.sendPasswordResetLink));

// Reset Password Routes
router.get("/reset-password", userController.renderResetPasswordForm);
router.post("/reset-password", wrapAsync(userController.resetPassword));


module.exports=router;