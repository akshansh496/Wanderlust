const { date } = require("joi");
const mongoose=require("mongoose");
const Schema=mongoose.Schema;

const reviewSchema=new Schema({
    comment:{
        type:String,
    },
    rating:{
        type:Number,
        min:1,
        max:5,
    },
    cleanlinessRating:{
        type:Number,
        min:1,
        max:5,
        default:5
    },
    communicationRating:{
        type:Number,
        min:1,
        max:5,
        default:5
    },
    accuracyRating:{
        type:Number,
        min:1,
        max:5,
        default:5
    },
    locationRating:{
        type:Number,
        min:1,
        max:5,
        default:5
    },
    valueRating:{
        type:Number,
        min:1,
        max:5,
        default:5
    },
    verifiedStay:{
        type:Boolean,
        default:true
    },
    listing:{
        type:Schema.Types.ObjectId,
        ref:"Listing"
    },
    booking:{
        type:Schema.Types.ObjectId,
        ref:"Booking"
    },
    created_at:{
        type:Date,
        default:Date.now,
    },
    author:{
        type:Schema.Types.ObjectId,
        ref:"User",
    }
})

module.exports=mongoose.model("Review",reviewSchema);