const Joi = require('joi');

module.exports.listingSchema=Joi.object({
    listing:Joi.object({
        title: Joi.string().required(),
        description: Joi.string().required(),
        location: Joi.string().required(),
        country: Joi.string().required(),
        price: Joi.number().required().min (0),
        image: Joi.string().allow("",null),
        lat: Joi.number().required().min(-90).max(90),
        lng: Joi.number().required().min(-180).max(180),
        category: Joi.string().valid("Mountains", "Beaches", "Cities").required(),
        features: Joi.array().items(Joi.string()).default([]),
    }).required(),
})

module.exports.reviewSchema=Joi.object({
    review:Joi.object({
        comment: Joi.string().required().min(20).max(1000).messages({
            'string.min': 'Review text must be at least 20 characters long.',
            'string.max': 'Review text cannot exceed 1000 characters.'
        }),
        rating: Joi.number().required().min(1).max(5),
        cleanlinessRating: Joi.number().min(1).max(5).default(5),
        communicationRating: Joi.number().min(1).max(5).default(5),
        accuracyRating: Joi.number().min(1).max(5).default(5),
        locationRating: Joi.number().min(1).max(5).default(5),
        valueRating: Joi.number().min(1).max(5).default(5),
        bookingId: Joi.string().optional()
    }).required(),
})

module.exports.userSchema = Joi.object({
    username: Joi.string().trim().min(2).max(50).required().pattern(/^(?!\d+$).+$/).messages({
        'string.empty': 'Name is required.',
        'string.min': 'Name must be at least 2 characters.',
        'string.max': 'Name is too long.',
        'string.pattern.base': 'Name cannot be numbers only.'
    }),
    email: Joi.string().trim().email().max(100).required().messages({
        'string.empty': 'Email is required.',
        'string.email': 'Please enter a valid email address.',
        'string.max': 'Email is too long.'
    }),
    password: Joi.string().min(8).max(100).required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/)
        .messages({
            'string.empty': 'Password is required.',
            'string.min': 'Password must be at least 8 characters long.',
            'string.max': 'Password is too long.',
            'string.pattern.base': 'Password must contain at least: one uppercase letter, one lowercase letter, one number, and one special character.'
        }),
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
        'any.only': 'Confirm password must match password.'
    })
});

module.exports.resetPasswordSchema = Joi.object({
    password: Joi.string().min(8).max(100).required()
        .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/)
        .messages({
            'string.empty': 'Password is required.',
            'string.min': 'Password must be at least 8 characters long.',
            'string.max': 'Password is too long.',
            'string.pattern.base': 'Password must contain at least: one uppercase letter, one lowercase letter, one number, and one special character.'
        }),
    confirmPassword: Joi.string().required().valid(Joi.ref('password')).messages({
        'any.only': 'Confirm password must match password.'
    }),
    token: Joi.string().required()
});