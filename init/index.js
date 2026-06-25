const mongoose=require("mongoose");
const initData=require("./data.js");
const Listing = require("../models/listing.js");

main()
.then(()=>{
    console.log("connection successful");
})
.catch(err=>{console.log(err)});
async function main() {
    await mongoose.connect('mongodb://127.0.0.1:27017/wanderlust');
}

const initDB=async ()=>{
    await Listing.deleteMany({});
    
    const categories = ["Mountains", "Beaches", "Cities"];
    const features = ["Wifi", "Parking", "Swimming Pool", "Air Conditioning", "Kitchen", "Washing Machine", "Workspace", "Pet Friendly", "TV", "Gym", "Balcony", "Garden", "Beach Access", "Mountain View", "Lake View", "Fireplace", "Hot Tub", "EV Charging", "Breakfast Included", "Self Check-in"];

    function getRandomElements(arr, num) {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, num);
    }

    initData.data=initData.data.map((obj, index)=>({
        ...obj,
        owner:"686f715721fecc1632964abc",
        lat: obj.lat || (20.5937 + (Math.random() - 0.5) * 5),
        lng: obj.lng || (78.9629 + (Math.random() - 0.5) * 5),
        category: categories[index % categories.length],
        features: getRandomElements(features, Math.floor(Math.random() * 4) + 3)
    }));
    
    await Listing.insertMany(initData.data);
    console.log("Data was initialised");
}

initDB();