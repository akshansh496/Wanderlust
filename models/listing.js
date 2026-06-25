const mongoose=require("mongoose");
const Schema=mongoose.Schema;
const Review=require("./review.js");

const listingSchema=new Schema({
    title:{
        type:String,
        required:true,
    },
    description:{
        type:String,
    },
    image:{
        url:{
            type:String
        },
        filename:{
            type:String
        }
    },
    price:{
        type:Number,
    },
    location:{
        type:String,
    },
    country: {
        type:String,
    },
    lat: {
        type: Number,
        required: true,
        default: 0
    },
    lng: {
        type: Number,
        required: true,
        default: 0
    },
    category: {
        type: String,
        enum: ["Mountains", "Beaches", "Cities"],
        required: true,
        default: "Mountains"
    },
    features: {
        type: [String],
        default: []
    },
    reviews:[
        {
            type:Schema.Types.ObjectId,
            ref:"Review"
        }
    ],
    owner:{
            type:Schema.Types.ObjectId,
            ref:"User",
        }
});

listingSchema.post("findOneAndDelete",async (listing)=>{
    if(listing)
    await Review.deleteMany({_id: {$in:listing.reviews}})
})

const Listing=mongoose.model("Listing",listingSchema);
module.exports=Listing;