const path = require("path");
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");
const Review = require("../models/review.js");
const Booking = require("../models/booking.js");

const dbUrl = process.env.MONGODB_URI || process.env.ATLASDB_URL || 'mongodb://127.0.0.1:27017/wanderlust';
const maskedDbUrl = dbUrl.replace(/:([^:@]+)@/, ":****@");
console.log(`Connecting to: ${maskedDbUrl}`);

main()
.then(()=>{
    console.log("connection successful");
})
.catch(err=>{console.log(err)});

async function main() {
    await mongoose.connect(dbUrl);
}

const initDB = async () => {
    await Listing.deleteMany({});
    await User.deleteMany({});
    await Review.deleteMany({});
    await Booking.deleteMany({});
    
    // Register a default owner user so that populated listings do not crash the app
    const defaultOwner = new User({
        email: "admin@wanderlust.com",
        username: "wanderlust_admin"
    });
    const registeredOwner = await User.register(defaultOwner, "admin123");
    console.log("Default owner registered successfully:", registeredOwner.username);

    // Register guest reviewers
    const guest1 = await User.register(new User({ email: "alice@gmail.com", username: "alice_smith" }), "alice123");
    const guest2 = await User.register(new User({ email: "bob@gmail.com", username: "bob_johnson" }), "bob123");
    const guest3 = await User.register(new User({ email: "charlie@gmail.com", username: "charlie_brown" }), "charlie123");
    const guests = [guest1, guest2, guest3];
    console.log("Guest reviewers registered.");

    const comments = [
        "Absolutely loved the place! The views were spectacular, and the cabin was clean.",
        "Highly recommend this spot. Great location, friendly hosts, and very cozy.",
        "Wonderful stay. Very clean, modern interior, and close to local attractions.",
        "A perfect weekend getaway. Extremely peaceful and surrounded by nature.",
        "Super clean and comfortable. Loved the amenities, wifi was fast, and beds were comfy.",
        "Breathtaking surroundings. The lake view in the morning was incredible.",
        "Great value for money. Spacious rooms and a fully equipped kitchen. Will return!",
        "Excellent hospitality! The host was extremely kind and responsive. Five stars all around.",
        "Very peaceful retreat. Clean air, quiet nights, and beautiful hiking trails nearby.",
        "Exceeded all expectations. Modern design, pristine cleanliness, and super fast response from host."
    ];

    const categories = ["Mountains", "Beaches", "Cities"];
    const featuresList = ["Wifi", "Parking", "Swimming Pool", "Air Conditioning", "Kitchen", "Washing Machine", "Workspace", "Pet Friendly", "TV", "Gym", "Balcony", "Garden", "Beach Access", "Mountain View", "Lake View", "Fireplace", "Hot Tub", "EV Charging", "Breakfast Included", "Self Check-in"];

    function getRandomElements(arr, num) {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, num);
    }

    console.log("Seeding listings with reviews...");
    for (let i = 0; i < initData.data.length; i++) {
        let rawListing = initData.data[i];
        
        const listing = new Listing({
            ...rawListing,
            owner: registeredOwner._id,
            lat: rawListing.lat || (20.5937 + (Math.random() - 0.5) * 5),
            lng: rawListing.lng || (78.9629 + (Math.random() - 0.5) * 5),
            category: categories[i % categories.length],
            features: getRandomElements(featuresList, Math.floor(Math.random() * 4) + 3),
            reviews: []
        });

        // Add 2 reviews for each property
        for (let j = 0; j < 2; j++) {
            const author = guests[Math.floor(Math.random() * guests.length)];
            const comment = comments[Math.floor(Math.random() * comments.length)];
            const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5 star reviews
            
            const review = new Review({
                comment,
                rating,
                cleanlinessRating: Math.floor(Math.random() * 2) + 4,
                communicationRating: Math.floor(Math.random() * 2) + 4,
                accuracyRating: Math.floor(Math.random() * 2) + 4,
                locationRating: Math.floor(Math.random() * 2) + 4,
                valueRating: Math.floor(Math.random() * 2) + 4,
                verifiedStay: true,
                listing: listing._id,
                author: author._id
            });

            await review.save();
            listing.reviews.push(review._id);
        }

        await listing.save();
    }
    
    console.log("Data was initialised with reviews successfully");
};

initDB();