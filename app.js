require('dotenv').config();

const express=require("express");
const app=express();
const mongoose=require("mongoose");
const path=require("path");
const methodOverride=require("method-override");
const ejsMate=require("ejs-mate");
const ExpressError=require("./utils/ExpressError");
const session=require("express-session");
const flash=require("connect-flash");
const passport=require("passport");
const LocalStrategy=require("passport-local");
const User=require("./models/user.js");

const listingsRouter=require("./routes/listing.js");
const reviewsRouter=require("./routes/review.js");
const usersRouter=require("./routes/user.js");
const bookingsRouter=require("./routes/booking.js");


app.set("view engine","ejs");
app.set("views",path.join(__dirname,"views"));
app.use(express.urlencoded({extended:true}));
app.use(methodOverride("_method"))
app.engine('ejs',ejsMate);
app.use(express.static(path.join(__dirname,"/public")));

const sessionoptions={
    secret:"mysupersecretstring",
    resave:false,
    saveUninitialized:true,
    cookie:{
        expires:Date.now()+7*24*60*60*1000,
        maxAge:7*24*60*60*1000,
        httpOnly:true,
    }
};

const dbUrl = process.env.MONGODB_URI || process.env.ATLASDB_URL || 'mongodb://127.0.0.1:27017/wanderlust';
main()
.then(()=>{
    console.log("Database connection successful");
})
.catch(err=>{
    console.error("Database connection error:", err);
});
async function main() {
    await mongoose.connect(dbUrl);
}



// app.get("/",(req,res)=>{
//     res.send("Hi,I am root");
// })

app.use(session(sessionoptions));
app.use(flash());


// app.use(session(sessionoptions));
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req,res,next)=>{
    res.locals.success=req.flash("success");
    res.locals.error=req.flash("error");
    res.locals.currUser=req.user;
    next();
})


// app.get("/demouser",async (req,res)=>{
//     let fakeUser=new User({
//         email:"student@getMaxListeners.com",
//         username:"delta-student",
//     })
//     let registeredUser=await User.register(fakeUser,"password");
//     res.send(registeredUser);
// })

app.use("/listings",listingsRouter);
app.use("/listings/:id/reviews",reviewsRouter);
app.use("/listings/:id/bookings",bookingsRouter);
app.use("/",usersRouter);


// app.get("/testListing",async (req,res)=>{
//     let sampleListing=new Listing({
//         title:"My Home",
//         description:"By the beach",
//         price:1200,
//         location:"Calangute,Goa",
//         country:"India",
//     });
//     await sampleListing.save();
//     console.log("sample was saved");
//     res.send("successful testing");
// })

app.all("*",(req,res,next)=>{
    next(new ExpressError(404,"Page not found"));
});
app.use((err,req,res,next)=>{
    let {statusCode=500,message="Something went wrong"}=err;
    // res.status(statusCode).send(message);
    res.status(statusCode).render("./listings/error.ejs",{message})
})

//Sendind cookies
// app.get("/cookies",(req,res)=>{
//     res.cookie("greet","namaste");
//     res.cookie("made in","India");
//     res.send("Sent you some cookies")
// })

app.listen(8080,()=>{
    console.log("Listening on port 8080");
})