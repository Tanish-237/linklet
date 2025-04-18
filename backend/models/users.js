import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: function(v) {
          return v.endsWith('@mnnit.ac.in');
        },
        message: props => 'Only @mnnit.ac.in email addresses are allowed'
      }
    },
    fullName: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default: "https://cdn-icons-png.flaticon.com/512/1326/1326382.png",
    },
    bio: {
      type: String,
      maxlength: 160,
    },
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    year: { type: String }, // e.g., "First", "Second"
    department: { type: String },
    skills: [{ type: String }], // e.g., ["Python", "React"]
    role: { type: String, enum: ["Student", "Alumni"], default: "Student" },
    refreshToken: {
      type: String,
    },
  },
  { timestamps: true }
);

//here we are hashing the password before saving it to the database

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    // Hash only if the password is modified
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

//we use methods to create a method for the schema
//here it  checks if given password matches with pass in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  const isMatch = await bcrypt.compare(enteredPassword, this.password);
  return isMatch;
};

// Create JWT Token
//const token = jwt.sign({ userId: user.id }, SECRET_KEY, { expiresIn: '1h' });

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id, //this is payload or we say data
      username: this.username,
      email: this.email,
      fullName: this.fullName,
    },
    process.env.ACCESS_TOKEN_SECRET, //this is secret key
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY, //this is expiry time
    }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id, //this is payload or we say data
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};

export const User = mongoose.model("User", userSchema);
