const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const ExpressError = require("./utils/ExpressError");
const session = require("express-session");
const MongoStore = require("connect-mongo").MongoStore;
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingsRouter = require("./routes/listing.js");
const reviewsRouter = require("./routes/review.js");
const usersRouter = require("./routes/user.js");
const bookingsRouter = require("./routes/booking.js");

const isProduction = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
const dbUrl =
  process.env.MONGODB_URI ||
  process.env.ATLASDB_URL ||
  "mongodb://127.0.0.1:27017/wanderlust";

if (isProduction) {
  app.set("trust proxy", 1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate);
app.use(express.static(path.join(__dirname, "/public")));

const sessionOptions = {
  name: "wanderlust.sid",
  secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || "mysupersecretstring",
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    mongoUrl: dbUrl,
    ttl: 7 * 24 * 60 * 60,
  }),
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "lax" : "lax",
  },
};

let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose.connect(dbUrl).then((mongooseInstance) => {
      console.log("Database connection successful");
      return mongooseInstance;
    });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

const maskedDbUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
const usingLocalDb = /127\.0\.0\.1|localhost/.test(dbUrl);

console.log(`Connecting to: ${maskedDbUrl}`);
if (usingLocalDb) {
  console.warn("WARNING: Using local MongoDB. Add MONGODB_URI to .env to use Atlas.");
}

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database connection error:", err);
    next(err);
  }
});

app.use(session(sessionOptions));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.currUser = req.user;
  next();
});

app.use("/listings", listingsRouter);
app.use("/listings/:id/reviews", reviewsRouter);
app.use("/listings/:id/bookings", bookingsRouter);
app.use("/", usersRouter);

app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page not found"));
});

app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong" } = err;
  res.status(statusCode).render("./listings/error.ejs", { message });
});

module.exports = app;

if (require.main === module) {
  connectDB()
    .then(() => {
      const port = process.env.PORT || 8080;
      app.listen(port, () => {
        console.log(`Listening on port ${port}`);
      });
    })
    .catch((err) => {
      console.error("Database connection error:", err);
      process.exit(1);
    });
}
